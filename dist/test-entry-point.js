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
exports.TestEntryPoint = void 0;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const utils_1 = require("./utils");
class TestEntryPoint {
	constructor() {
		// Dirty signifies that new test file has been addeed, and is cleared once the entryPoint is written.
		this.dirty = false;
		this.files = new Set();
		this.dir = fs.realpathSync(os.tmpdir());
		// The `file` is a dummy, meant to allow Karma to work. But, we can't write
		// to it without causing Karma to refresh. So, we have a real file that we
		// write to, and allow esbuild to build from.
		this.file = path.join(this.dir, `${utils_1.random(16)}-bundle.js`);
	}
	addFile(file) {
		const normalized = path
			.relative(this.dir, file)
			.replace(/\\/g, path.posix.sep);
		if (this.files.has(normalized)) return;
		this.files.add(normalized);
		this.dirty = true;
	}
	write() {
		if (!this.dirty) return;
		this.dirty = false;
		const files = Array.from(this.files).map(file => {
			return `import "${file}";`;
		});
		fs.writeFileSync(this.file, files.join("\n"));
	}
	touch() {
		fs.writeFileSync(this.file, "");
	}
}
exports.TestEntryPoint = TestEntryPoint;
