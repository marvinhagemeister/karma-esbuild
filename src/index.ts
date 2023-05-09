import { debounce, formatTime } from "./utils";
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

interface KarmaEsbuildConfig {
	esbuild?: esbuild.BuildOptions & {
		bundleDelay?: number;
		singleBundle?: boolean;
	};
}

type KarmaPreprocess = (
	content: any,
	file: KarmaFile,
	done: (err: Error | null, content?: string | null | Buffer) => void,
) => void;

interface KarmaLogger {
	create(label: string): Log;
}

function getBasePath(config: karma.ConfigOptions) {
	return config.basePath ? path.normalize(config.basePath) : process.cwd();
}

function createPreprocessor(
	config: karma.ConfigOptions & KarmaEsbuildConfig,
	emitter: karma.Server,
	testEntryPoint: TestEntryPoint,
	bundlerMap: BundlerMap,
	logger: KarmaLogger,
): KarmaPreprocess {
	const log = logger.create("esbuild");
	const {
		bundleDelay = 700,
		format,
		singleBundle = true,
	} = config.esbuild || {};

	// Inject middleware to handle the bundled file and map.
	config.middleware ||= [];
	config.middleware.push("esbuild");

	// Create an empty file for Karma to track. Karma requires a real file in
	// order for it to be injected into the page, even though the middleware
	// will be responsible for serving it.
	config.files ||= [];

	if (singleBundle) {
		// Push the entry point so that Karma will load the file when the runner starts.
		config.files.push({
			pattern: testEntryPoint.file,
			included: true,
			served: false,
			watched: false,
			type: format === "esm" ? "module" : "js",
		});
		testEntryPoint.touch();
		bundlerMap.addPotential(testEntryPoint.file);
	}

	const basePath = getBasePath(config);

	// Install our own error formatter to provide sourcemap unminification.
	// Karma's default error reporter will call it, after it does its own
	// unminification. It'd be awesome if we could just provide the maps for
	// them to consume, but it's impossibly difficult.
	config.formatError = createFormatError(
		bundlerMap,
		basePath,
		config.formatError,
	);

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

		if (config.exclude) watcher.unwatch(config.exclude);

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

	// Logging
	const pendingBundles = new Set<string>();
	let start = 0;
	bundlerMap.on("start", ev => {
		if (singleBundle) {
			start = ev.time;
			log.info(`Compiling to ${ev.file}...`);
		} else if (!pendingBundles.size) {
			start = ev.time;
			log.info(`Compiling...`);
		}
		pendingBundles.add(ev.file);
	});

	bundlerMap.on("stop", () => {
		pendingBundles.clear();
	});

	bundlerMap.on("done", ev => {
		pendingBundles.delete(ev.file);
		if (singleBundle || pendingBundles.size === 0) {
			log.info(`Compiling done (${formatTime(ev.endTime - start)})`);
		}
	});

	const buildSingleBundle = debounce(() => {
		// Prevent service closed message when we are still processing
		if (stopped) return;
		testEntryPoint.write();

		const bundle = bundlerMap.get(testEntryPoint.file);
		return bundle.write();
	}, bundleDelay);

	return async function preprocess(content, file, done) {
		// We normalize the file extension to always be '.js', which allows us to
		// run '.ts' files as test entry-points in a `singleBundle: false` setup.
		const jsPath = file.originalPath.replace(/\.[^/.]+$/, ".js");

		// Karma likes to turn a win32 path (C:\foo\bar) into a posix-like path (C:/foo/bar).
		// Normally this wouldn't be so bad, but `bundle.file` is a true win32 path, and we
		// need to test equality.
		let filePath = path.normalize(jsPath);

		if (singleBundle) {
			testEntryPoint.addFile(filePath);
			filePath = testEntryPoint.file;
		} else {
			bundlerMap.addPotential(filePath);
		}

		const bundle = bundlerMap.get(filePath);
		bundle.dirty();

		if (singleBundle) {
			await buildSingleBundle();
			// Turn the file into a `dom` type with empty contents to get Karma to
			// inject the contents as HTML text. Since the contents are empty, it
			// effectively drops the script from being included into the Karma runner.
			file.type = "dom";
			done(null, "");
		} else {
			const res = await bundlerMap.read(filePath);
			file.path = jsPath;
			done(null, res.code);
		}
	};
}
createPreprocessor.$inject = [
	"config",
	"emitter",
	"karmaEsbuildEntryPoint",
	"karmaEsbuildBundlerMap",
	"logger",
];

function createMiddleware(bundlerMap: BundlerMap, config: karma.ConfigOptions) {
	return async function (
		req: IncomingMessage,
		res: ServerResponse,
		next: () => void,
	) {
		const match = /^\/(absolute|base\/)([^?#]*?)(\.map)?(?:\?|#|$)/.exec(
			req.url || "",
		);
		if (!match) {
			return next();
		}

		const fileUrl = match[2];
		const isSourceMap = match[3] === ".map";

		let filePath = path.normalize(fileUrl);
		if (match[1] == "base/") {
			const basePath = getBasePath(config);
			const absolute = path.join(basePath, filePath);
			// Verify that we're in the same basepath if filePath is `../../foo`
			if (absolute.startsWith(basePath)) {
				filePath = absolute;
			}
		}
		if (!bundlerMap.has(filePath)) return next();

		const item = await bundlerMap.read(filePath);
		if (isSourceMap) {
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify(item.map, null, 2));
		} else {
			res.setHeader("Content-Type", "text/javascript");
			res.end(item.code);
		}
	};
}
createMiddleware.$inject = ["karmaEsbuildBundlerMap", "config"];

function createEsbuildBundlerMap(
	logger: KarmaLogger,
	karmaConfig: karma.ConfigOptions & KarmaEsbuildConfig,
) {
	const log = logger.create("esbuild");
	const basePath = getBasePath(karmaConfig);
	const { bundleDelay, singleBundle, ...userConfig } =
		karmaConfig.esbuild || {};

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
