import { Config } from "pentf/config";
import { assertEventuallyProgresses, runKarma } from "./test-utils";

export const description = "Run a single test";
export async function run(config: Config) {
	const { output } = await runKarma(config, "simple");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /1 test completed/.test(line));
	});
}
