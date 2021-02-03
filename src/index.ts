import { debounce, formatTime } from "./utils";
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

export interface CacheItem {
	file: string;
	content: string;
	mapFile: string;
	mapContent: string;
}

const cache = new Map<string, CacheItem>();

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

	const logDone = (time: number) => {
		log.info(`Compiling done (${formatTime(time)})`);
	};

	async function build(files: string | string[]) {
		files = !Array.isArray(files) ? [files] : files;

		const userConfig = { ...config.esbuild };

		const result = await service!.build({
			target: "es2015",
			...userConfig,
			watch,
			bundle: true,
			write: false,
			entryPoints: files,
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

		return result;
	}

	const entries = new Set<string>();

	const watchMode = !config.singleRun && !!config.autoWatch;
	const onWatchChange = debounce(async () => {
		emitter.refreshFiles();
	}, 100);
	const watch = watchMode
		? {
				onRebuild(
					error: esbuild.BuildFailure | null,
					result: esbuild.BuildResult | null,
				) {
					error && log.error(error.message);
					result && onWatchChange();
				},
		  }
		: false;

	const afterPreprocess = (time: number) => {
		logDone(Date.now() - time);
	};

	let stopped = false;
	let count = 0;
	let startTime = 0;
	return async function preprocess(content, file, done) {
		// Prevent service closed message when we are still processing
		if (stopped) return;

		if (count === 0) {
			log.info("Compiling...");
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

		try {
			const result = await build([file.originalPath]);
			const map = result.outputFiles[0];
			const mapText = JSON.parse(map.text) as SourceMapPayload;

			// Sources paths must be absolute, otherwise vscode will be unable
			// to find breakpoints
			mapText.sources = mapText.sources.map(s => path.join(base, s));

			const source = result.outputFiles[1];
			const relative = path.relative(base, file.originalPath);
			const code = source.text + `\n//# sourceMappingURL=/base/${relative}.map`;
			cache.set(relative, {
				file: source.path,
				content: code,
				mapFile: map.path,
				mapContent: JSON.stringify(mapText, null, 2),
			});

			// Necessary for mappings in stack traces
			file.sourceMap = mapText;

			if (--count === 0) {
				afterPreprocess(startTime);
			}
			done(null, code);
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
	return function (
		req: IncomingMessage,
		res: ServerResponse,
		next: () => void,
	) {
		const url = (req.url || "").replace(/^\/base\//, "");

		const key = url.replace(/\.map$/, "");
		const item = cache.get(key);
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
