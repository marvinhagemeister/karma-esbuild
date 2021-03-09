import { assertEventuallyProgresses, runKarma } from "./test-utils";
import { promises as fs } from "fs";
import path from "path";
import { strict as assert } from "assert";

export const description = "Rebuild on watch";
export async function run(config: any) {
	const { output, resetLog } = await runKarma(config, "watch-double");

	await assertEventuallyProgresses(output.stdout, () => {
		return (
			output.stdout.some(line => /\[esbuild\]: Compiling done/.test(line)) &&
			output.stdout.some(line => /2 tests completed/.test(line))
		);
	});

	const aPath = path.join(
		__dirname,
		"fixtures",
		"watch-double",
		"files",
		"main-a.js",
	);
	const bPath = path.join(
		__dirname,
		"fixtures",
		"watch-double",
		"files",
		"main-b.js",
	);

	const [aContent, bContent] = await Promise.all([
		fs.readFile(aPath, "utf-8"),
		fs.readFile(bPath, "utf-8"),
	]);
	const write = (filePath: string, content: string) =>
		fs.writeFile(filePath, content, "utf-8");

	resetLog();
	await write(aPath, aContent);
	await assertEventuallyProgresses(output.stdout, () => {
		return (
			output.stdout.some(line => /\[esbuild\]: Compiling done/.test(line)) &&
			output.stdout.some(line => /2 tests completed/.test(line))
		);
	});
	assert.equal(
		output.stdout.filter(line => /2 tests completed/.test(line)).length,
		1,
		"Only one build and run should happen",
	);

	resetLog();
	await write(bPath, bContent);
	await assertEventuallyProgresses(output.stdout, () => {
		return (
			output.stdout.some(line => /\[esbuild\]: Compiling done/.test(line)) &&
			output.stdout.some(line => /2 tests completed/.test(line))
		);
	});
	assert.equal(
		output.stdout.filter(line => /2 tests completed/.test(line)).length,
		1,
		"Only one build and run should happen",
	);
}
