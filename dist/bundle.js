"use strict";
var __createBinding =
	(this && this.__createBinding) ||
	(Object.create
		? function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				Object.defineProperty(o, k2, {
					enumerable: true,
					get: function () {
						return m[k];
					},
				});
		  }
		: function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				o[k2] = m[k];
		  });
var __setModuleDefault =
	(this && this.__setModuleDefault) ||
	(Object.create
		? function (o, v) {
				Object.defineProperty(o, "default", { enumerable: true, value: v });
		  }
		: function (o, v) {
				o["default"] = v;
		  });
var __importStar =
	(this && this.__importStar) ||
	function (mod) {
		if (mod && mod.__esModule) return mod;
		var result = {};
		if (mod != null)
			for (var k in mod)
				if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
					__createBinding(result, mod, k);
		__setModuleDefault(result, mod);
		return result;
	};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bundle = void 0;
const path = __importStar(require("path"));
const esbuild = __importStar(require("esbuild"));
const utils_1 = require("./utils");
class Bundle {
	constructor(file, log, config, emitter) {
		this.file = file;
		this.log = log;
		this.config = config;
		this.emitter = emitter;
		// Dirty signifies that that the current result is stale, and a new build is
		// needed. It's reset during the next build.
		this._dirty = true;
		// buildInProgress tracks the in-progress build. When a build takes too
		// long, a new build may have been requested before the original completed.
		// In this case, we resolve that in-progress build with the pending one.
		this.buildInProgress = null;
		this.deferred = new utils_1.Deferred();
		this.context = null;
		this.startTime = 0;
		// The sourcemap must be synchronously available for formatError.
		this.sourcemap = {};
		this.config = { ...config, entryPoints: [file] };
	}
	dirty() {
		if (this._dirty) return;
		this._dirty = true;
		this.deferred = new utils_1.Deferred();
	}
	isDirty() {
		return this._dirty;
	}
	async write() {
		if (this.buildInProgress === null) {
			this.beforeProcess();
		} else {
			// Wait for the previous build to happen before we continue. This prevents
			// any reentrant behavior, and guarantees we can get an initial bundle to
			// create incremental builds from.
			await this.buildInProgress;
			// There have been multiple calls to write in the time we were
			// waiting for the in-progress build. Instead of making multiple
			// calls to rebuild, we resolve with the new in-progress build. One
			// of the write calls "won" this wait on the in-progress build, and
			// that winner will eventually resolve the deferred.
			if (this.buildInProgress !== null) {
				return this.deferred.promise;
			}
		}
		const { deferred } = this;
		this._dirty = false;
		const build = this.bundle();
		this.buildInProgress = build;
		const result = await build;
		this.buildInProgress = null;
		// The build took so long, we've already had another test file dirty the
		// bundle. Instead of serving a stale build, let's wait for the new one
		// to resolve. The new build either hasn't called `write` yet, or it's
		// waiting in the `await this.buildInProgress` above. Either way, it'll
		// eventually fire off a new rebuild and resolve the deferred.
		if (deferred !== this.deferred) {
			const { promise } = this.deferred;
			deferred.resolve(promise);
			return promise;
		}
		this.afterProcess();
		deferred.resolve(result);
		return result;
	}
	beforeProcess() {
		this.startTime = Date.now();
		this.emitter.emit("start", {
			type: "start",
			file: this.file,
			time: this.startTime,
		});
	}
	afterProcess() {
		this.emitter.emit("done", {
			type: "done",
			file: this.file,
			startTime: this.startTime,
			endTime: Date.now(),
		});
	}
	read() {
		return this.deferred.promise;
	}
	async stop() {
		var _a;
		// Wait for any in-progress builds to finish. At this point, we know no
		// new ones will come in, we're just waiting for the current one to
		// finish running.
		if (this.buildInProgress || this._dirty) {
			// Wait on the deferred, not the buildInProgress, because the dirty flag
			// means a new build is imminent. The deferred will only be resolved after
			// that build is done.
			await this.deferred.promise;
		}
		// Releasing the result allows the child process to end.
		(_a = this.context) === null || _a === void 0 ? void 0 : _a.dispose();
		this.context = null;
		this.emitter.emit("stop", { type: "stop", file: this.file });
	}
	async bundle() {
		try {
			if (this.context == null) {
				this.context = await esbuild.context(this.config);
			}
			const result = await this.context.rebuild();
			const { outputFiles } = result;
			if (outputFiles == null || outputFiles.length < 2) {
				return {
					code: Buffer.from(
						`console.error("No output files.", ${JSON.stringify(result)})`,
					),
					map: {},
				};
			} else {
				return this.processResult(outputFiles);
			}
		} catch (err) {
			const { message } = err;
			this.log.error(message);
			return {
				code: Buffer.from(`console.error(${JSON.stringify(message)})`),
				map: {},
			};
		}
	}
	processResult(outputFiles) {
		const map = JSON.parse(outputFiles[0].text);
		const source = outputFiles[1];
		const basename = path.basename(this.file);
		const code = Buffer.from(source.contents.buffer);
		const outdir = this.config.outdir;
		map.sources = map.sources.map(s => path.join(outdir, s));
		map.file = basename;
		this.sourcemap = map;
		return { code, map };
	}
}
exports.Bundle = Bundle;
