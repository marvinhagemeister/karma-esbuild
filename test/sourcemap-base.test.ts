import { assertEventuallyProgresses, runKarma } from "./test-utils";

export const description =
	"Resolve source maps from files served via /base url";
export async function run(config: any) {
	const { output } = await runKarma(config, "sourcemap-base");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /2 tests completed/.test(line));
	});
}
