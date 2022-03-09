import { SourceMapConsumer } from "source-map";
import * as path from "path";

import type { Bundle } from "./bundle";
import type { BundlerMap } from "./bundler-map";
import type { RawSourceMap } from "source-map";

type Formatter = (m: string) => string;

export function createFormatError(
	bundlerMap: BundlerMap,
	basePath: string,
	formatError?: Formatter,
) {
	const consumers = new WeakMap<RawSourceMap, SourceMapConsumer>();
	const regex = /((?:\b[A-Z]:)?[^ #?:(]+)[^ :]*:(\d+):(\d+)/gi;
	//             |            |         ||    ||    |^^^^^^ Column
	//             |            |         ||    |^^^^^^ Line
	//             |            |         |^^^^^^ Eat any reamining URL (query in particular)
	//             ^^^^^^^^^^^^^^^^^^^^^^^^ URL pathname extraction
	//             ^^^^^^^^^^^^^^ Optionally find a leading win32 disk name (eg, C:)

	function get(sourcemap: RawSourceMap) {
		const existing = consumers.get(sourcemap);
		if (existing) return existing;
		const consumer = new SourceMapConsumer(sourcemap);
		consumers.set(sourcemap, consumer);
		return consumer;
	}

	function format(file: string, line: number, column: number) {
		return `${file}:${line}:${column}`;
	}

	return (message: string) => {
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
			} catch {
				return match;
			}
		});
		return formatError ? formatError(unminified) : unminified + "\n";
	};
}
