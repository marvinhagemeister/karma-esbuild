import child_process from "child_process";
import { runKarma } from "./test-utils";

const args = process.argv;
if (args.length <= 2) {
	console.error("Missing fixture argument: run-karma [my-fixture]");
	process.exit(1);
}
const mockConfig = {
	_teardown_hooks: [],
};
runKarma(mockConfig, args[2], { inherit: true });
