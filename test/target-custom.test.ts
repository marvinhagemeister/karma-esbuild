import { assertEventuallyProgresses, runKarma } from "./test-utils";

export const description = "Allow custom target setting";
export async function run(config: any) {
	const { output } = await runKarma(config, "target-custom");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /1 test completed/.test(line));
	});
}
