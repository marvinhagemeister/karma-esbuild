import { assertEventuallyProgresses, runKarma } from "./test-utils";
import { promises as fs } from "fs";
import path from "path";
import { onTeardown } from "pentf/runner";
import { strict as assert } from "assert";

export const description =
	"Reentrant writes after initial build waits for in-progress build to finish, only one pending build may succeed";
export async function run(config: any) {
	const { output, resetLog } = await runKarma(config, "reentrant-rebundle");

	// Both main-*.js tests are necessary, so that we call the preprocessor twice.

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /2 tests completed/.test(line));
	});

	const filePath = path.join(
		__dirname,
		"fixtures",
		"reentrant-rebundle",
		"files",
		"sub",
		"dep1.js",
	);

	const content = await fs.readFile(filePath, "utf-8");
	const write = (content: string) => fs.writeFile(filePath, content, "utf-8");

	onTeardown(config, async () => {
		await write(content);
	});

	resetLog();

	for (let i = 0; i < 6; i++) {
		await new Promise(resolve => {
			const exp = 2 ** i;
			setTimeout(resolve, 5 * exp);
		});
		await write(content);
	}

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /2 tests completed/.test(line));
	});

	const files = output.stdout.join("\n").match(/file: .*/g);
	assert.equal(files?.length, 8);

	// A full build should happen, then the rebuild.
	const firstBuild = files.splice(0, 4);
	firstBuild.sort();
	files.sort();

	// We expect the first build to have loaded all 4 files in the esbuild plugin.
	// Only then can the second build start.
	assert.deepEqual(firstBuild, files);

	// Only one build and run should happen,
	assert.equal(
		output.stdout.filter(line => /2 tests completed/.test(line)).length,
		1,
	);
}
