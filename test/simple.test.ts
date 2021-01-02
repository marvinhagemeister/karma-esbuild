import { Config } from "pentf/config";
import { runKarma } from "./test-utils";
import { assertEventually } from "pentf/assert_utils";

export const description = "Run a single test";
export async function run(config: Config) {
	const { output } = await runKarma(config, "simple-test");

	await assertEventually(() => {
		return output.stdout.find(line => /1 test completed/.test(line));
	});
}
