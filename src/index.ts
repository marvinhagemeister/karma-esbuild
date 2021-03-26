import { debounce } from "./utils";
import { BundlerMap } from "./bundler-map";
import { TestEntryPoint } from "./test-entry-point";
import { createFormatError } from "./format-error";
import chokidar from "chokidar";
import * as path from "path";

import type esbuild from "esbuild";
import type karma from "karma";
import type { IncomingMessage, ServerResponse } from "http";
import type { FSWatcher } from "chokidar";
import type { Log } from "./utils";

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
	testEntryPoint: TestEntryPoint,
	bundlerMap: BundlerMap,
): KarmaPreprocess {
	const basePath = getBasePath(config);
	const { bundleDelay = 700, format } = config.esbuild || {};

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
		type: format === "esm" ? "module" : "js",
	});
	testEntryPoint.touch();
	const entryPointBundle = bundlerMap.get(testEntryPoint.file);

	// Install our own error formatter to provide sourcemap unminification.
	// Karma's default error reporter will call it, after it does its own
	// unminification. It'd be awesome if we could just provide the maps for
	// them to consume, but it's impossibly difficult.
	config.formatError = createFormatError(bundlerMap, config.formatError);

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
			emitter.refreshFiles();
		}, 100);
		watcher.on("change", onWatch);
		watcher.on("add", onWatch);
	}

	let stopped = false;
	emitter.on("exit", done => {
		stopped = true;
		bundlerMap.stop().then(done);
	});

	const buildBundle = debounce(() => {
		// Prevent service closed message when we are still processing
		if (stopped) return;
		testEntryPoint.write();
		bundlerMap.dirty();
		return entryPointBundle.write();
	}, bundleDelay);

	return async function preprocess(content, file, done) {
		// Karma likes to turn a win32 path (C:\foo\bar) into a posix-like path (C:/foo/bar).
		// Normally this wouldn't be so bad, but `bundle.file` is a true win32 path, and we
		// need to test equality.
		const filePath = path.normalize(file.originalPath);

		testEntryPoint.addFile(filePath);
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
	"karmaEsbuildEntryPoint",
	"karmaEsbuildBundlerMap",
];

function createMiddleware(bundlerMap: BundlerMap) {
	return async function (
		req: IncomingMessage,
		res: ServerResponse,
		next: () => void,
	) {
		const match = /^\/absolute([^?#]*?)(\.map)?(?:\?|#|$)/.exec(req.url || "");
		if (!match) return next();

		const filePath = path.normalize(match[1]);
		if (!bundlerMap.has(filePath)) return next();

		const item = await bundlerMap.read(filePath);
		if (match[2] === ".map") {
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify(item.map, null, 2));
		} else {
			res.setHeader("Content-Type", "text/javascript");
			res.end(item.code);
		}
	};
}
createMiddleware.$inject = ["karmaEsbuildBundlerMap"];

function createEsbuildBundlerMap(
	logger: KarmaLogger,
	karmaConfig: karma.ConfigOptions & {
		esbuild?: esbuild.BuildOptions & { bundleDelay?: number };
	},
) {
	const log = logger.create("esbuild");
	const basePath = getBasePath(karmaConfig);
	const { bundleDelay, ...userConfig } = karmaConfig.esbuild || {};

	// Use some trickery to get the root in both posix and win32. win32 could
	// have multiple drive paths as root, so find root relative to the basePath.
	const outdir = path.resolve(basePath, "/");

	const config: esbuild.BuildOptions = {
		target: "es2015",
		...userConfig,
		outdir,
		sourcemap: true,
		bundle: true,
		write: false,
		incremental: true,
		platform: "browser",
		define: {
			"process.env.NODE_ENV": JSON.stringify(
				process.env.NODE_ENV || "development",
			),
			...userConfig.define,
		},
	};

	return new BundlerMap(log, config);
}
createEsbuildBundlerMap.$inject = ["logger", "config"];

function createTestEntryPoint() {
	return new TestEntryPoint();
}
createTestEntryPoint.$inject = [] as const;

module.exports = {
	"preprocessor:esbuild": ["factory", createPreprocessor],
	"middleware:esbuild": ["factory", createMiddleware],

	karmaEsbuildBundlerMap: ["factory", createEsbuildBundlerMap],
	karmaEsbuildEntryPoint: ["factory", createTestEntryPoint],
};
