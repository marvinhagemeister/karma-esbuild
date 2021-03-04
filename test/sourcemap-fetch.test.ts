import { assertEventuallyProgresses, runKarma } from "./test-utils";

export const description = "Unknown files are not treated as sourcemaps";
export async function run(config: any) {
	const { output } = await runKarma(config, "sourcemap-fetch");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /2 tests completed/.test(line));
	});
}
