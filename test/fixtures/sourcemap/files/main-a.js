import { fetchPolyfill } from "../../../fetch-polyfill.js";
// "env" module is synthetically created by the karma.conf.js using an esbuild plugin.
import expectedSources from "env";

describe("simple", () => {
	it("should work", async () => {
		const js = await fetchPolyfill("/base/files/sub/main-b.js").then(res =>
			res.text(),
		);

		const m = js.match(/\/\/# sourceMappingURL=(.*)$/);
		if (!m || m.length < 1) {
			throw new Error("Unable to find source map url");
		}
		if (m[1] !== "main-b.js.map") {
			throw new Error("unexpected sourceMappingURL value");
		}

		const mapText = await fetchPolyfill(
			"/base/files/sub/main-b.js.map",
		).then(res => res.text());
		const { sources } = JSON.parse(mapText);

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
