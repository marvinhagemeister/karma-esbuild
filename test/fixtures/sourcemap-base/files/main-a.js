import { fetchPolyfill } from "../../../fetch-polyfill.js";
// "env" module is synthetically created by the karma.conf.js using an esbuild plugin.
import expectedSources from "env";

describe("simple", () => {
	it("should work", async () => {
		const script = document.querySelector('script[src*="main-a.js"]');
		const { pathname } = new URL(script.src);
		const js = await fetchPolyfill(script.src).then(res => res.text());

		const m = js.match(/\/\/# sourceMappingURL=(.*)/);
		if (!m || m.length < 1) {
			throw new Error("Unable to find source map url");
		}

		const filename = /[^/]+$/.exec(pathname);
		if (m[1] !== `${filename}.map`) {
			throw new Error(
				`unexpected sourceMappingURL value, wanted "${filename}.map" but got "${m[1]}"`,
			);
		}

		const mapText = await fetchPolyfill(`${pathname}.map`).then(res =>
			res.text(),
		);
		const ignore = /env-ns/;
		const sources = JSON.parse(mapText)
			.sources.filter(s => !ignore.test(s))
			.sort();

		if (sources.length !== expectedSources.length) {
			throw new Error(
				`source length differs, wanted ${expectedSources.length} but got ${sources.length}`,
			);
		}
		expectedSources.forEach((expected, i) => {
			if (sources[i] !== expected) {
				throw new Error(
					`source ${i} differs, wanted "${expected}" but got "${sources[i]}"`,
				);
			}
		});
	});
});
