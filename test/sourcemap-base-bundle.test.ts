import { assertEventuallyProgresses, runKarma } from "./test-utils";
import { strict as assert } from "assert";

export const description =
	"Resolve source maps from files served via /base url";
export async function run(config: any) {
	const { output } = await runKarma(config, "sourcemap-base-bundle");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /1 test completed/.test(line));
	});

	// Check for mapped file
	const reg = /at.*\((.*):\d+:\d+\)/;
	const trace = output.stdout.find(line => reg.test(line)) || "";
	assert.match(trace, /dep2\.js:3:1/);
}
