import chokidar, { FSWatcher } from "chokidar";
import { debounce, formatTime } from "./utils";
import * as karma from "karma";
import * as esbuild from "esbuild";

interface KarmaFile {
	originalPath: string;
	path: string;
	contentPath: string;
	sourceMap?: any; // TODO: Unsure if this exists
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

function createPreprocessor(
	config: karma.ConfigOptions & { esbuild: esbuild.BuildOptions },
	emitter: karma.Server,
	logger: KarmaLogger,
): KarmaPreprocess {
	const log = logger.create("esbuild");

	let service: esbuild.Service | null = null;

	const logDone = (time: number) => {
		log.info(`Compiling done (${formatTime(time)})`);
	};

	async function build(files: string | string[]) {
		files = !Array.isArray(files) ? [files] : files;

		const userConfig = { ...config.esbuild };

		const result = await service!.build({
			...userConfig,
			bundle: true,
			write: false,
			entryPoints: files,
			platform: "browser",
			sourcemap: "inline",
			target: "es2015",
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

		const onWatch = debounce(async () => {
			emitter.refreshFiles();
		}, 100);
		watcher.on("change", onWatch);
		watcher.on("add", onWatch);
	}

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
			const code = result.outputFiles[0].text;
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

module.exports = {
	"preprocessor:esbuild": ["factory", createPreprocessor],
};
