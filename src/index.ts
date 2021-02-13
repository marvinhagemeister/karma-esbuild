import { debounce, formatTime } from "./utils";
import { newCache } from "./cache";
import chokidar, { FSWatcher } from "chokidar";
import * as karma from "karma";
import * as esbuild from "esbuild";
import * as path from "path";
import { SourceMapPayload } from "module";
import { IncomingMessage, ServerResponse } from "http";

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

const cache = newCache();

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

	let service: esbuild.Service | null = null;

	function processResult(
		result: esbuild.BuildResult & {
			outputFiles: esbuild.OutputFile[];
		},
		file: string,
	) {
		const map = result.outputFiles[0];
		const mapText = JSON.parse(map.text) as SourceMapPayload;

		// Sources paths must be absolute, otherwise vscode will be unable
		// to find breakpoints
		mapText.sources = mapText.sources.map(s => path.join(base, s));

		const source = result.outputFiles[1];
		const relative = path.relative(base, file);

		const code = source.text + `\n//# sourceMappingURL=/base/${relative}.map`;

		cache.set(relative, {
			file: source.path,
			content: code,
			mapFile: map.path,
			mapText,
			mapContent: JSON.stringify(mapText, null, 2),
			time: Date.now(),
		});
		return cache.get(relative)!;
	}

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
			emitter.refreshFiles();
		}, 100);
		watcher.on("change", onWatch);
		watcher.on("add", onWatch);
	}

	async function build(file: string) {
		const userConfig = { ...config.esbuild };

		const result = await service!.build({
			target: "es2015",
			...userConfig,
			bundle: true,
			write: false,
			entryPoints: [file],
			platform: "browser",
			sourcemap: "external",
			outdir: base,
			define: {
				"process.env.NODE_ENV": JSON.stringify(
					process.env.NODE_ENV || "development",
				),
				...userConfig.define,
			},
		});

		return processResult(result, file);
	}

	const entries = new Set<string>();

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
		if (stopped) return;

		if (count === 0) {
			beforeProcess();
			startTime = Date.now();
		}

		count++;

		entries.add(file.originalPath);
		if (service === null) {
			service = await esbuild.startService();
			emitter.on("exit", done => {
				stopped = true;
				service!.stop();
				done();
			});
		}

		const relative = path.relative(base, file.originalPath);
		try {
			const result = cache.has(relative)
				? await cache.get(relative)
				: await build(file.originalPath);

			// Necessary for mappings in stack traces
			file.sourceMap = result.mapText;

			if (--count === 0) {
				afterPreprocess(startTime);
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
		// Always resolve from cache directly
		const item = await cache.get(key);
		if (item) {
			res.setHeader("Content-Type", "application/json");
			res.end(item.mapContent);
		} else {
			next();
		}
	};
}

module.exports = {
	"preprocessor:esbuild": ["factory", createPreprocessor],
	"middleware:esbuild": ["factory", createSourceMapMiddleware],
};
