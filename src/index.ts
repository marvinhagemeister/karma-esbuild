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
	if (!config.singleRun && config.autoWatch) {
		// Initialize watcher to listen for changes in basePath so
		// that we'll be notified of any new files
		const basePath = config.basePath || process.cwd();
		watcher = chokidar.watch([basePath], {
			ignoreInitial: true,
			// Ignore dot files and anything from node_modules
			ignored: /((^|[/\\])\..|\/node_modules\/)/,
		});
		// Register shutdown handler
		emitter.on("exit", done => {
			watcher!.close();
			done();
		});

		const onWatch = async () => {
			const start = Date.now();
			log.info("Compiling...");

			await Promise.all(Array.from(entries).map(entry => build(entry)));

			logDone(Date.now() - start);
			emitter.refreshFiles();
		};
		watcher.on("change", onWatch);
		watcher.on("add", onWatch);
	}

	let start = 0;
	const afterPreprocess = debounce(() => {
		logDone(Date.now() - start);
		start = 0;
	}, 100);

	return async function preprocess(content, file, done) {
		if (start === 0) {
			log.info("Compiling...");
			start = Date.now();
		}

		entries.add(file.originalPath);
		if (service === null) {
			console.log(esbuild);
			service = await esbuild.startService();
			emitter.on("exit", done => {
				service!.stop();
				done();
			});
		}

		try {
			const result = await build([file.originalPath]);
			const code = result.outputFiles[0].text;
			done(null, code);
		} catch (err) {
			log.error(err.message);
			done(null, content);
		} finally {
			afterPreprocess();
		}
	};
}
createPreprocessor.$inject = ["config", "emitter", "logger"];

module.exports = {
	"preprocessor:esbuild": ["factory", createPreprocessor],
};
