import { Config } from "pentf/config";
import { assertEventuallyProgresses, runKarma } from "./test-utils";

export const description = "Run a single test with a bundle";
export async function run(config: Config) {
	const { output } = await runKarma(config, "simple-bundle");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /should work/.test(line));
	});
	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /1 test completed/.test(line));
	});
}
