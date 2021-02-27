import { debounce, formatTime } from "./utils";
import { newCache } from "./cache";
import { compile } from "./compile";
import chokidar, { FSWatcher } from "chokidar";
import * as karma from "karma";
import * as esbuild from "esbuild";
import * as path from "path";
import * as fs from "fs";
import { IncomingMessage, ServerResponse } from "http";
import minimatch from "minimatch";
import globby from "globby";
import tempy, { file } from "tempy";
import { SourceMapPayload } from "module";

interface KarmaFile {
	originalPath: string;
	path: string;
	contentPath: string;
	/** This is a must for mapped stack traces */
	sourceMap?: SourceMapPayload;
}

type KarmaPreprocess = (
	content: any,
	file: KarmaFile,
	done: (err: Error | null, content?: string | null) => void,
) => Promise<void>;

interface KarmaLogger {
	create(
		label: string,
	): {
		info(message: string): void;
		error(message: string): void;
	};
}

export interface CacheItem {
	file: string;
	content: string;
	sourceMapPath: string;
	sourceMapContent: string;
	time: number;
}

const cache = newCache<CacheItem>();

function createPreprocessor(
	config: karma.ConfigOptions & { esbuild: esbuild.BuildOptions },
	emitter: karma.Server,
	logger: KarmaLogger,
): KarmaPreprocess {
	const log = logger.create("esbuild");
	const base = config.basePath || process.cwd();

	// Inject sourcemap middleware
	if (!config.middleware) {
		config.middleware = [];
	}
	config.middleware.push("esbuild");
	console.log(config);

	// Mapping of merged entry path to entry content
	const entries = new Map<string, string>();

	const preprocessors = config.preprocessors || (config.preprocessors = {});
	let fileCount = 0;
	config.files = (config.files || []).map(item => {
		const entry = typeof item === "string" ? { pattern: item } : item;

		// We'll create a single bundle for each specified file
		// pattern, otherwise karma feeds us the test files
		// one by one. To avoid that we replace the pattern
		// with a single file wich imports everything that is
		// matched by the pattern.
		if (/[tj]sx?$/.test(entry.pattern)) {
			const tmp = tempy.file({
				name: `karma-esbuild-entry-${fileCount}.js`,
			});

			const content = globby
				.sync(entry.pattern)
				.map(file => {
					const rel = path.relative(path.dirname(tmp), file);
					const normalized = rel.split(path.sep).join(path.posix.sep);
					return `import "${normalized}";`;
				})
				.join("\n");

			fs.writeFileSync(tmp, content, "utf-8");
			entries.set(tmp, content);

			entry.pattern = tmp;

			// Ensure that our file matches our preprocessor
			preprocessors[tmp] = ["esbuild"];
		}

		return entry;
	});

	let service: esbuild.Service | null = null;

	let watcher: FSWatcher | null = null;
	const watchMode = !config.singleRun && !!config.autoWatch;
	if (watchMode) {
		// Initialize watcher to listen for changes in basePath so
		// that we'll be notified of any new files
		const basePath = config.basePath || process.cwd();
		watcher = chokidar.watch([basePath], {
			ignoreInitial: true,
			// Ignore dot files and anything from node_modules
			ignored: /((^|[/\\])\..|node_modules)/,
		});
		// Register shutdown handler
		emitter.on("exit", done => {
			watcher!.close();
			done();
		});

		const onWatch = debounce(() => {
			cache.clear();
			emitter.refreshFiles();
		}, 100);
		watcher.on("change", onWatch);
		watcher.on("add", onWatch);
	}

	const beforeProcess = debounce(() => {
		log.info("Compiling...");
	}, 10);
	const afterPreprocess = debounce((time: number) => {
		log.info(`Compiling done (${formatTime(Date.now() - time)})`);
	}, 10);

	let stopped = false;
	let count = 0;
	let startTime = 0;
	return async function preprocess(content, file, done) {
		// Prevent service closed message when we are still processing
		console.log("PROCESS", file);
		if (stopped) return;

		if (count === 0) {
			beforeProcess();
			startTime = Date.now();
		}

		count++;

		if (service === null) {
			service = await esbuild.startService();
			emitter.on("exit", done => {
				stopped = true;
				service!.stop();
				done();
			});
		}

		const relative = path.relative(base, file.originalPath);

		const cacheKey = file.originalPath;
		try {
			let result = null;
			if (cache.has(cacheKey)) {
				result = await cache.get(cacheKey);
			} else {
				console.log("cacheKey", cacheKey);
				result = await compile(service!, relative, config.esbuild || {}, base);
			}

			// Necessary for mappings in stack traces
			file.sourceMap = JSON.parse(result.sourceMapContent);

			if (--count === 0) {
				afterPreprocess(startTime);
			}

			// for TypeScript support.
			if (path.extname(file.path) !== ".js") {
				file.path = `${
					file.path.substr(0, file.path.lastIndexOf(".")) || file.path
				}.js`;
			}

			done(null, result.content);
		} catch (err) {
			// Use a non-empty string because `karma-sourcemap` crashes
			// otherwse.
			const dummy = `(function () {})()`;
			// Prevent flood of error logs when we shutdown
			if (stopped) {
				done(null, dummy);
				return;
			}

			log.error(err.message);
			if (--count === 0) {
				afterPreprocess(startTime);
			}

			if (watchMode) {
				// Never return an error in watch mode, otherwise the
				// watcher will shutdown.
				// Use a dummy file instead because the original content
				// may content syntax not supported by a browser or the
				// way the script was loaded. This breaks the watcher too.
				done(null, dummy);
			} else {
				done(err, null);
			}
		}
	};
}
createPreprocessor.$inject = ["config", "emitter", "logger"];

function createSourceMapMiddleware() {
	return async function (
		req: IncomingMessage,
		res: ServerResponse,
		next: () => void,
	) {
		const url = (req.url || "").replace(/^\/base\//, "");

		const key = url.replace(/\.map$/, "");
		if (cache.has(key)) {
			const item = await cache.get(key);
			res.setHeader("Content-Type", "application/json");
			res.end(item.sourceMapContent);
		} else {
			next();
		}
	};
}

module.exports = {
	"preprocessor:esbuild": ["factory", createPreprocessor],
	"middleware:esbuild": ["factory", createSourceMapMiddleware],
};
