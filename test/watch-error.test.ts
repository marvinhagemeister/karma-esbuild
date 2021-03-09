import { assertEventuallyProgresses, runKarma } from "./test-utils";
import { promises as fs } from "fs";
import path from "path";
import { onTeardown } from "pentf/runner";

export const description = "Syntax errors should not break watcher";
export async function run(config: any) {
	const { output, resetLog } = await runKarma(config, "watch-error");

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /1 test completed/.test(line));
	});

	const filePath = path.join(
		__dirname,
		"fixtures",
		"watch-error",
		"files",
		"dep1.js",
	);

	const content = await fs.readFile(filePath, "utf-8");
	const write = (content: string) => fs.writeFile(filePath, content, "utf-8");

	onTeardown(config, async () => {
		await write(content);
	});

	resetLog();
	await write(`export function;;;123+++++`);

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line =>
			/\[esbuild\]: Build failed with/.test(line),
		);
	});

	resetLog();
	await write(content);
	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /1 test completed/.test(line));
	});
}
