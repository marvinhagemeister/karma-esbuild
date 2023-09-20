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
exports.createFormatError = void 0;
const source_map_1 = require("source-map");
const path = __importStar(require("path"));
function createFormatError(bundlerMap, basePath, formatError) {
	const consumers = new WeakMap();
	const regex = /((?:\b[A-Z]:)?[^ #?:(]+)[^ :]*:(\d+):(\d+)/gi;
	//             |            |         ||    ||    |^^^^^^ Column
	//             |            |         ||    |^^^^^^ Line
	//             |            |         |^^^^^^ Eat any reamining URL (query in particular)
	//             ^^^^^^^^^^^^^^^^^^^^^^^^ URL pathname extraction
	//             ^^^^^^^^^^^^^^ Optionally find a leading win32 disk name (eg, C:)
	function get(sourcemap) {
		const existing = consumers.get(sourcemap);
		if (existing) return existing;
		const consumer = new source_map_1.SourceMapConsumer(sourcemap);
		consumers.set(sourcemap, consumer);
		return consumer;
	}
	function format(file, line, column) {
		return `${file}:${line}:${column}`;
	}
	return message => {
		const unminified = message.replace(regex, (match, source, line, column) => {
			source = path.normalize(source);
			if (!path.isAbsolute(source)) {
				source = path.join(basePath, source);
			}
			if (!bundlerMap.has(source)) return match;
			try {
				const bundle = bundlerMap.get(source);
				const consumer = get(bundle.sourcemap);
				const loc = consumer.originalPositionFor({
					line: +line,
					column: +column - 1,
				});
				return `${format(loc.source, loc.line, loc.column + 1)} <- ${format(
					source,
					line,
					column,
				)}`;
			} catch (_a) {
				return match;
			}
		});
		return formatError ? formatError(unminified) : unminified + "\n";
	};
}
exports.createFormatError = createFormatError;
