import { debounce, formatTime } from "./utils";
import { Bundle } from "./bundle";
import { TestEntryPoint } from "./test-entry-point";
import chokidar from "chokidar";
import * as path from "path";

import type esbuild from "esbuild";
import type karma from "karma";
import type { SourceMapPayload } from "module";
import type { IncomingMessage, ServerResponse } from "http";
import type { FSWatcher } from "chokidar";
import type { Log } from "./utils";

interface KarmaFile {
	originalPath: string;
	path: string;
	contentPath: string;
	/** This is a must for mapped stack traces */
	sourceMap?: SourceMapPayload;
	type: karma.FilePatternTypes;
}

type KarmaPreprocess = (
	content: any,
	file: KarmaFile,
	done: (err: Error | null, content?: string | null) => void,
) => void;

interface KarmaLogger {
	create(label: string): Log;
}

function getBasePath(config: karma.ConfigOptions) {
	return config.basePath || process.cwd();
}

function createPreprocessor(
	config: karma.ConfigOptions & {
		esbuild?: { bundleDelay?: number };
	},
	emitter: karma.Server,
	log: Log,
	testEntryPoint: TestEntryPoint,
	bundle: Bundle,
): KarmaPreprocess {
	const basePath = getBasePath(config);
	const { bundleDelay = 700 } = config.esbuild || {};

	// Inject middleware to handle the bundled file and map.
	if (!config.middleware) {
		config.middleware = [];
	}
	config.middleware.push("esbuild");

	// Create an empty file for Karma to track. Karma requires a real file in
	// order for it to be injected into the page, even though the middleware
	// will be responsible for serving it.
	if (!config.files) {
		config.files = [];
	}
	// Set preprocessor for our file to install sourceMap on it, giving Karma
	// the ability do unminify stack traces.
	config.preprocessors![testEntryPoint.file] = ["esbuild"];
	// For the sourcemapping to work, the file must be served by Karma, preprocessed, and have
	// the preproccessor attach a file.sourceMap.
	config.files.push({
		pattern: testEntryPoint.file,
		included: true,
		served: true,
		watched: false,
	});
	testEntryPoint.touch();

	let watcher: FSWatcher | null = null;
	const watchMode = !config.singleRun && !!config.autoWatch;
	if (watchMode) {
		// Initialize watcher to listen for changes in basePath so
		// that we'll be notified of any new files
		watcher = chokidar.watch([basePath], {
			ignoreInitial: true,
			// Ignore dot files and anything from node_modules
			ignored: /(^|[/\\])(\.|node_modules[/\\])/,
		});

		const alreadyWatched = config.files.reduce((watched: string[], file) => {
			if (typeof file === "string") {
				watched.push(file);
			} else if (file.watched) {
				watched.push(file.pattern);
			}
			return watched;
		}, []);
		watcher.unwatch(alreadyWatched);

		// Register shutdown handler
		emitter.on("exit", done => {
			watcher!.close();
			done();
		});

		const onWatch = debounce(() => {
			// Dirty the bundle first, to make sure we don't attempt to read an
			// already compiled result.
			bundle.dirty();
			emitter.refreshFiles();
		}, 100);
		watcher.on("change", onWatch);
		watcher.on("add", onWatch);
	}

	let startTime = 0;
	function beforeProcess() {
		startTime = Date.now();
		log.info(`Compiling to ${testEntryPoint.file}...`);
	}
	function afterProcess() {
		log.info(
			`Compiling done (${formatTime(Date.now() - startTime)}, with ${formatTime(
				bundleDelay,
			)} delay)`,
		);
	}

	let stopped = false;
	emitter.on("exit", done => {
		stopped = true;
		bundle.stop().then(done);
	});

	const buildBundle = debounce(() => {
		// Prevent service closed message when we are still processing
		if (stopped) return;
		testEntryPoint.write();
		return bundle.write(beforeProcess, afterProcess);
	}, bundleDelay);

	return async function preprocess(content, file, done) {
		// Karma likes to turn a win32 path (C:\foo\bar) into a posix-like path (C:/foo/bar).
		// Normally this wouldn't be so bad, but `bundle.file` is a true win32 path, and we
		// need to test equality.
		const filePath = path.normalize(file.originalPath);

		// If we're "preprocessing" the bundle file, all we need is to wait for
		// the bundle to be generated for it.
		if (filePath === testEntryPoint.file) {
			const item = await bundle.read();
			file.sourceMap = item.map;
			done(null, item.code);
			return;
		}

		testEntryPoint.addFile(filePath);
		bundle.dirty();
		buildBundle();

		// Turn the file into a `dom` type with empty contents to get Karma to
		// inject the contents as HTML text. Since the contents are empty, it
		// effectively drops the script from being included into the Karma runner.
		file.type = "dom";
		done(null, "");
	};
}
createPreprocessor.$inject = [
	"config",
	"emitter",
	"karmaEsbuildLogger",
	"karmaEsbuildEntryPoint",
	"karmaEsbuildBundler",
];

function createSourcemapMiddleware(
	testEntryPoint: TestEntryPoint,
	bundle: Bundle,
) {
	return async function (
		req: IncomingMessage,
		res: ServerResponse,
		next: () => void,
	) {
		const match = /^\/absolute([^?#]*)\.map(\?|#|$)/.exec(req.url || "");
		if (!match) return next();

		const filePath = path.normalize(match[1]);
		if (filePath !== testEntryPoint.file) return next();

		const item = await bundle.read();
		res.setHeader("Content-Type", "application/json");
		res.end(JSON.stringify(item.map, null, 2));
	};
}
createSourcemapMiddleware.$inject = [
	"karmaEsbuildEntryPoint",
	"karmaEsbuildBundler",
];

function createEsbuildLog(logger: KarmaLogger) {
	return logger.create("esbuild");
}
createEsbuildLog.$inject = ["logger"];

function createEsbuildConfig(
	config: karma.ConfigOptions & {
		esbuild?: esbuild.BuildOptions & { bundleDelay?: number };
	},
) {
	const basePath = getBasePath(config);
	const { bundleDelay, ...userConfig } = config.esbuild || {};

	// Use some trickery to get the root in both posix and win32. win32 could
	// have multiple drive paths as root, so find root relative to the basePath.
	userConfig.outdir = path.resolve(basePath, "/");
	return userConfig;
}
createEsbuildConfig.$inject = ["config"];

function createEsbuildBundler(
	testEntryPoint: TestEntryPoint,
	log: Log,
	config: esbuild.BuildOptions,
) {
	return new Bundle(testEntryPoint.file, log, config);
}
createEsbuildBundler.$inject = [
	"karmaEsbuildEntryPoint",
	"karmaEsbuildLogger",
	"karmaEsbuildConfig",
];

function createTestEntryPoint() {
	return new TestEntryPoint();
}
createTestEntryPoint.$inject = [] as const;

module.exports = {
	"preprocessor:esbuild": ["factory", createPreprocessor],
	"middleware:esbuild": ["factory", createSourcemapMiddleware],

	karmaEsbuildLogger: ["factory", createEsbuildLog],
	karmaEsbuildConfig: ["factory", createEsbuildConfig],
	karmaEsbuildBundler: ["factory", createEsbuildBundler],
	karmaEsbuildEntryPoint: ["factory", createTestEntryPoint],
};
