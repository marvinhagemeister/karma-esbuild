import { fetchPolyfill } from "../../../fetch-polyfill.js";

describe("sourcemap-fetch", () => {
	async function getMap(selector) {
		const script = document.querySelector(selector);
		const url = script.src.replace(/[?#].*/, "") + ".map";
		const resp = await fetchPolyfill(url);
		if (resp.status >= 400) {
			throw resp.status;
		}
		return resp.status;
	}

	it("should fetch real sourcemap", () => {
		return getMap('script[src*="-bundle.js"]');
	});

	it("should 404 unknown file", () => {
		// Mocha is not compiled by esbuild processor.
		return getMap('script[src*="node_modules/mocha/mocha.js"]').then(
			() => {
				throw new Error("expected this to fail");
			},
			s => {
				if (s !== 404) {
					throw new Error("expected a 404 response");
				}
			},
		);
	});
});
