import { assertEventuallyProgresses, runKarma } from "./test-utils";

export const description = "Resolve source maps relative to an absolute root";
export async function run(config: any) {
	const { output } = await runKarma(config, "sourcemap");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /2 tests completed/.test(line));
	});
}
