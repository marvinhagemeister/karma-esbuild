import { Service, BuildOptions } from "esbuild";
import { SourceMapPayload } from "module";
import * as path from "path";

/**
 * Compile and bundle the specified entry file. We do some
 * light changes on the output to ensure that external
 * source maps work and that any inline breakpoints set in
 * vscode are hit correctly.
 */
export async function compile(
	service: Service,
	file: string,
	esbuildConfig: BuildOptions,
	base: string,
) {
	const result = await service!.build({
		target: "es2015",
		...esbuildConfig,
		bundle: true,
		write: false,
		entryPoints: [file],
		platform: "browser",
		sourcemap: "external",
		absWorkingDir: process.cwd(),
		outdir: base,
		define: {
			"process.env.NODE_ENV": JSON.stringify(
				process.env.NODE_ENV || "development",
			),
			...esbuildConfig.define,
		},
	});

	const map = result.outputFiles[0];
	const mapText = JSON.parse(map.text) as SourceMapPayload;

	// Sources paths must be absolute, otherwise vscode will be unable
	// to find breakpoints
	mapText.sources = mapText.sources.map(s => path.join(base, s));

	const source = result.outputFiles[1];
	const relative = path.relative(base, file);

	const code = source.text + `\n//# sourceMappingURL=/base/${relative}.map`;

	return {
		file: source.path,
		content: code,
		sourceMapPath: map.path,
		sourceMapContent: JSON.stringify(mapText, null, 2),
	};
}
