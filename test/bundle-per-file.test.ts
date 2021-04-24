import { Config } from "pentf/config";
import { strict as assert } from "assert";
import fetch from "node-fetch";
import { assertEventuallyProgresses, runKarma } from "./test-utils";

export const description = "Create a separate bundle per test file";
export async function run(config: Config) {
	const { output } = await runKarma(config, "bundle-per-file");

	// Both main-*.js tests are necessary, so that we call the preprocessor twice.

	await assertEventuallyProgresses(output.stdout, () => {
		return output.stdout.some(line => /2 tests completed/.test(line));
	});

	let address;
	for (const line of output.stdout) {
		const match = line.match(/(https?:\/\/localhost:\d+)/);
		if (match) {
			address = match[1];
		}
	}

	// Check that dependency is not inlined
	let res = await fetch(`${address}/base/files/main-a.js`);
	let text = await res.text();
	assert.match(text, /CONTENT/);

	res = await fetch(`${address}/base/files/main-b.js`);
	text = await res.text();
	assert.match(text, /CONTENT/);

	// Check that we have no duplicate "compiling..." messages
	assert.equal(
		output.stdout.filter(line => /Compiling\.\.\./i.test(line)).length,
		1,
	);
	assert.equal(
		output.stdout.filter(line => /Compiling done/i.test(line)).length,
		1,
	);
}
