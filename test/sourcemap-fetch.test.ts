import { runKarma } from "./test-utils";
import { assertEventually } from "pentf/assert_utils";
import { newPage } from "pentf/browser_utils";
import path from "path";
import { strict as assert } from "assert";
import { SourceMapPayload } from "module";

export const description = "Unknown files are not treated as sourcemaps";
export async function run(config: any) {
	const { output } = await runKarma(config, "sourcemap-fetch");

	await assertEventually(() => {
		return output.stdout.find(line => /2 tests completed/.test(line));
	});
}
