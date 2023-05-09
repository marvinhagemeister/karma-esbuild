import { assertEventuallyProgresses, runKarma } from "./test-utils";
import { strict as assert } from "assert";

export const description =
	"Resolve source maps from files served via /base url";
export async function run(config: any) {
	const { output } = await runKarma(config, "sourcemap-base-bundle");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /SUMMARY/.test(line));
	});

	// Check for mapped source file
	await assertEventuallyProgresses(output.stdout, () => {
		assert.match(output.stdout.join("\n"), /main-a\.js:3:9/);
		return true;
	});

	// Check for mapped dependency file
	await assertEventuallyProgresses(output.stdout, () => {
		assert.match(output.stdout.join("\n"), /dep2\.js:2:8/);
		return true;
	});
}
