import { debounce } from "./utils";
import { Bundle } from "./bundle";
import { TestEntryPoint } from "./test-entry-point";
import chokidar from "chokidar";
import * as path from "path";
import { SourceMapConsumer } from "source-map";

import type esbuild from "esbuild";
import type karma from "karma";
import type { IncomingMessage, ServerResponse } from "http";
import type { FSWatcher } from "chokidar";
import type { Log } from "./utils";
import { RawSourceMap } from "source-map";

interface KarmaFile {
	originalPath: string;
	path: string;
	contentPath: string;
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
		esbuild?: esbuild.BuildOptions & { bundleDelay?: number };
	},
	emitter: karma.Server,
	log: Log,
	testEntryPoint: TestEntryPoint,
	bundle: Bundle,
): KarmaPreprocess {
	const basePath = getBasePath(config);
	const { bundleDelay = 700 } = config.esbuild || {};

	// Inject middleware to handle the bundled file and map.
	config.middleware ||= [];
	config.middleware.push("esbuild");

	// Create an empty file for Karma to track. Karma requires a real file in
	// order for it to be injected into the page, even though the middleware
	// will be responsible for serving it.
	config.files ||= [];
	// Push the entry point so that Karma will load the file when the runner starts.
	config.files.push({
		pattern: testEntryPoint.file,
		included: true,
		served: false,
		watched: false,
	});
	testEntryPoint.touch();

	// Install our own error formatter to provide sourcemap unminification.
	// Karma's default error reporter will call it, after it does its own
	// unminification. It'd be awesome if we could just provide the maps for
	// them to consume, but it's impossibly difficult.
	config.formatError = createFormatError(bundle, config.formatError);

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

	let stopped = false;
	emitter.on("exit", done => {
		stopped = true;
		bundle.stop().then(done);
	});

	const buildBundle = debounce(() => {
		// Prevent service closed message when we are still processing
		if (stopped) return;
		testEntryPoint.write();
		return bundle.write();
	}, bundleDelay);

	return async function preprocess(content, file, done) {
		// Karma likes to turn a win32 path (C:\foo\bar) into a posix-like path (C:/foo/bar).
		// Normally this wouldn't be so bad, but `bundle.file` is a true win32 path, and we
		// need to test equality.
		const filePath = path.normalize(file.originalPath);

		testEntryPoint.addFile(filePath);
		bundle.dirty();
		await buildBundle();

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

function createMiddleware(bundle: Bundle) {
	return async function (
		req: IncomingMessage,
		res: ServerResponse,
		next: () => void,
	) {
		const match = /^\/absolute([^?#]*?)(\.map)?(?:\?|#|$)/.exec(req.url || "");
		if (!match) return next();

		const filePath = path.normalize(match[1]);
		if (filePath !== bundle.file) return next();

		const item = await bundle.read();
		if (match[2] === ".map") {
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify(item.map, null, 2));
		} else {
			res.setHeader("Content-Type", "text/javascript");
			res.end(item.code);
		}
	};
}
createMiddleware.$inject = ["karmaEsbuildBundler"];

function createFormatError(
	bundle: Bundle,
	formatError?: (m: string) => string,
) {
	const consumers = new WeakMap<RawSourceMap, SourceMapConsumer>();
	const regex = /(\/[^ #?:]+)[^ :]*:(\d+):(\d+)/g;

	function get(sourcemap: RawSourceMap) {
		const existing = consumers.get(sourcemap);
		if (existing) return existing;
		const consumer = new SourceMapConsumer(bundle.sourcemap);
		consumers.set(sourcemap, consumer);
		return consumer;
	}

	function format(file: string, line: number, column: number) {
		return `${file}:${line}:${column}`;
	}

	return (message: string) => {
		const unminified = message.replace(regex, (match, path, line, column) => {
			if (path !== bundle.file) return match;

			try {
				const consumer = get(bundle.sourcemap);
				const loc = consumer.originalPositionFor({
					line: +line,
					column: +column - 1,
				});
				return `${format(loc.source, loc.line, loc.column + 1)} <- ${format(
					path,
					line,
					column,
				)}`;
			} catch {
				return match;
			}
		});
		return formatError ? formatError(unminified) : unminified + "\n";
	};
}

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
	"middleware:esbuild": ["factory", createMiddleware],

	karmaEsbuildLogger: ["factory", createEsbuildLog],
	karmaEsbuildConfig: ["factory", createEsbuildConfig],
	karmaEsbuildBundler: ["factory", createEsbuildBundler],
	karmaEsbuildEntryPoint: ["factory", createTestEntryPoint],
};
