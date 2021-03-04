import { assertEventuallyProgresses, runKarma } from "./test-utils";
import { promises as fs } from "fs";
import path from "path";
import { onTeardown } from "pentf/runner";

export const description = "Register new entry files on watch";
export async function run(config: any) {
	const { output, resetLog } = await runKarma(config, "watch-add");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /1 test completed/.test(line));
	});

	const filePath = path.join(
		__dirname,
		"fixtures",
		"watch-add",
		"files",
		"main-b.js",
	);

	onTeardown(config, async () => fs.unlink(filePath));

	resetLog();

	// Add new test file
	await fs.writeFile(filePath, `it('bar', () => {})`, "utf-8");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /2 tests completed/.test(line));
	});
}
