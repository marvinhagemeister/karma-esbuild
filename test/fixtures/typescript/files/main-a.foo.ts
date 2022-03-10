import { fetchPolyfill } from "../../../fetch-polyfill.js";

describe("simple", () => {
	it("should work", () => {
		return true;
	});

	it("should change file extension to .js", () => {
		const script = document.querySelector('script[src*=".ts"]');
		if (script) {
			throw new Error("found .ts script");
		}
	});

	it("should serve with correct content-type", async () => {
		const script = document.querySelector('script[src*="main-a.foo.js"]');

		const resp = await fetchPolyfill(script.src);
		if (resp.status !== 200) {
			throw new Error(resp.status);
		}

		const type = resp.headers.get("content-type");
		if (!/(text|application)\/javascript/.test(type)) {
			throw new Error(type);
		}
	});

	it("should serve .js.map", async () => {
		const script = document.querySelector('script[src*="main-a.foo.js"]');

		const src = `${script.src.replace(/[?#].*/, "")}.map`;
		const resp = await fetchPolyfill(src);
		if (resp.status !== 200) {
			throw new Error(resp.status);
		}

		JSON.parse(await resp.text());
	});
});
