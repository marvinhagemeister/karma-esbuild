import { assertEventuallyProgresses, runKarma } from "./test-utils";
import { newPage } from "pentf/browser_utils";
import { strict as assert } from "assert";

export const description = "Allow custom target setting";
export async function run(config: any) {
	const { output } = await runKarma(config, "target-custom");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /1 test completed/.test(line));
	});

	const match = output.stdout
		.join("\n")
		.match(/open (https?:\/\/localhost:\d{4})\//);
	if (!match || match.length < 1)
		throw new Error("Unable to find server address");

	const address = match[1];

	const page = await newPage(config);
	await page.goto(`${address}/debug.html`);

	const js = await page.evaluate(() => {
		return fetch("/base/files/main-a.js").then(res => res.text());
	});

	const content = js.replace(/\/\/# sourceMappingURL.*/, "").trim();

	const expected = `(function() {
  // test/fixtures/target-custom/files/main-a.js
  describe("simple", function() {
    it("should work", function() {
      return true;
    });
  });
})();`;

	assert.equal(content, expected);
}
