import { assertEventuallyProgresses, runKarma } from "./test-utils";
import { newPage } from "pentf/browser_utils";
import path from "path";
import { strict as assert } from "assert";
import { SourceMapPayload } from "module";

export const description = "Resolve source maps relative to an absolute root";
export async function run(config: any) {
	const { output } = await runKarma(config, "sourcemap");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /2 tests completed/.test(line));
	});

	const match = output.stdout
		.join("\n")
		.match(/open (https?:\/\/localhost:\d{4})\//);
	if (!match || match.length < 1) {
		throw new Error("Unable to find server address");
	}

	const address = match[1];

	const page = await newPage(config);
	await page.goto(`${address}/debug.html`);

	const js = await page.evaluate(() => {
		return fetch("/base/files/sub/main-b.js").then(res => res.text());
	});

	const m = js.match(/\/\/# sourceMappingURL=(.*)$/);
	if (!m || m.length < 1) {
		throw new Error("Unable to find source map url");
	}

	assert.equal(m[1], "/base/files/sub/main-b.js.map");

	const mapText = await page.evaluate(() => {
		return fetch("/base/files/sub/main-b.js.map").then(res => res.text());
	});

	const map = JSON.parse(mapText) as SourceMapPayload;

	assert.deepStrictEqual(map.sources, [
		path.join(process.cwd(), "/test/fixtures/sourcemap/files/sub/dep2.js"),
		path.join(process.cwd(), "/test/fixtures/sourcemap/files/sub/main-b.js"),
	]);
}
