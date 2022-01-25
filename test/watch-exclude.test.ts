import { assertEventuallyProgresses, runKarma } from "./test-utils";
import { promises as fs } from "fs";
import path from "path";
import { onTeardown } from "pentf/runner";

export const description = "Respects `exclude` param in karma config";
export async function run(config: any) {
	const { output, resetLog } = await runKarma(config, "watch-exclude");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /1 test completed/.test(line));
	});

	const excludedPath = path.join(
		__dirname,
		"fixtures",
		"watch-exclude",
		"files",
		"excluded",
		"excluded.ts",
	);
	const testPath = path.join(
		__dirname,
		"fixtures",
		"watch-exclude",
		"files",
		"main-a.js",
	);

	resetLog();

	// Change excluded file
	const write = (path: string, content: string) =>
		fs.writeFile(path, content, "utf-8");

	const fileContent = await fs.readFile(excludedPath, "utf-8");
	const testContent = await fs.readFile(testPath, "utf-8");
	const changedContent = fileContent.replace('"excluded"', '"included"');

	await write(excludedPath, changedContent);

	/* uncommenting the following validates that the `exclude` is working as the
	 * test now fails due to `assertEventuallyProgresses` timing out
	 */
	// await assertEventuallyProgresses(output.stdout, () => {
	// 	return output.stdout.some(line => /1 test failed/.test(line));
	// });

	resetLog();
	await write(testPath, testContent);

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /1 test failed/.test(line));
	});

	onTeardown(config, async () => {
		await write(excludedPath, fileContent);
		await write(testPath, testContent);
	});
}
