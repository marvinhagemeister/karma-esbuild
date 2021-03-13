import { SourceMapConsumer } from "source-map";

import type { Bundle } from "./bundle";
import type { RawSourceMap } from "source-map";

type Formatter = (m: string) => string;

export function createFormatError(bundle: Bundle, formatError?: Formatter) {
	const consumers = new WeakMap<RawSourceMap, SourceMapConsumer>();
	const regex = /((?:\b[A-Z]:)?\/[^ #?:]+)[^ :]*:(\d+):(\d+)/gi;

	function get(sourcemap: RawSourceMap) {
		const existing = consumers.get(sourcemap);
		if (existing) return existing;
		const consumer = new SourceMapConsumer(bundle.sourcemap);
		consumers.set(sourcemap, consumer);
		return consumer;
	}

	function format(file: string, line: number, column: number) {
		return `${file}:${line}:${column}`;
	}

	return (message: string) => {
		const unminified = message.replace(regex, (match, path, line, column) => {
			if (path !== bundle.file) return match;

			try {
				const consumer = get(bundle.sourcemap);
				const loc = consumer.originalPositionFor({
					line: +line,
					column: +column - 1,
				});
				return `${format(loc.source, loc.line, loc.column + 1)} <- ${format(
					path,
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
