import { Config } from "pentf/config";
import { assertEventuallyProgresses, runKarma } from "./test-utils";

export const description = "Create a separate bundle per test file";
export async function run(config: Config) {
	const { output } = await runKarma(config, "bundle-per-file");

	// Both main-*.js tests are necessary, so that we call the preprocessor twice.

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /2 tests completed/.test(line));
	});
}
