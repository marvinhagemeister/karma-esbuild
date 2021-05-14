import { promises as fs } from "fs";
import path from "path";
import { onTeardown } from "pentf/runner";
import { assertEventuallyProgresses, runKarma } from "./test-utils";

export const description = "Watch separate bundles per test file";
export async function run(config: any) {
	const { output, resetLog } = await runKarma(config, "bundle-per-file-watch");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /2 tests completed/.test(line));
	});

	const filePath = path.join(
		__dirname,
		"fixtures",
		"bundle-per-file-watch",
		"files",
		"dep1.js",
	);

	const content = await fs.readFile(filePath, "utf-8");
	const write = (content: string) => fs.writeFile(filePath, content, "utf-8");

	onTeardown(config, async () => {
		await write(content);
	});

	resetLog();
	await write(`export function foo() { return 2 }`);

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /2 tests failed/.test(line));
	});

	resetLog();
	await write(content);
	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /2 tests completed/.test(line));
	});
}
