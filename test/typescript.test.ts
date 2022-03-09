import { Config } from "pentf/config";
import { assertEventuallyProgresses, runKarma } from "./test-utils";

export const description = "Run a single test";
export async function run(config: Config) {
	const { output } = await runKarma(config, "typescript");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /4 tests completed/.test(line));
	});
}
