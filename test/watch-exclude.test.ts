import { assertEventuallyProgresses, runKarma } from "./test-utils";
import { promises as fs } from "fs";
import path from "path";
import { onTeardown } from "pentf/runner";
import { assertAlways } from "pentf/assert_utils";

export const description = "Respects `exclude` param in karma config";
export async function run(config: any) {
	const { output, resetLog } = await runKarma(config, "watch-exclude");
	// Change excluded file
	const write = (path: string, content: string) =>
		fs.writeFile(path, content, "utf-8");
	onTeardown(config, async () => {
		await write(excludedPath, fileContent);
		await write(testPath, testContent);
	});

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

	const fileContent = await fs.readFile(excludedPath, "utf-8");
	const testContent = await fs.readFile(testPath, "utf-8");
	const changedContent = fileContent.replace("123", "321");

	resetLog();
	await write(excludedPath, changedContent);

	await assertAlways(() => output.stdout.length === 0, {
		message: `Unexpected compilation output when changing excluded file.`,
	});

	resetLog();
	await write(testPath, testContent);

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /1 test failed/.test(line));
	});
}
