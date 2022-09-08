import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { random } from "./utils";

export class TestEntryPoint {
	// Dirty signifies that new test file has been addeed, and is cleared once the entryPoint is written.
	private dirty = false;
	private files = new Set<string>();

	private dir = fs.realpathSync(os.tmpdir());
	// The `file` is a dummy, meant to allow Karma to work. But, we can't write
	// to it without causing Karma to refresh. So, we have a real file that we
	// write to, and allow esbuild to build from.
	file = path.join(this.dir, `${random(16)}-bundle.js`);

	addFile(file: string) {
		const normalized = path
			.relative(this.dir, file)
			.replace(/\\/g, path.posix.sep);

		if (this.files.has(normalized)) return;
		this.files.add(normalized);
		this.dirty = true;
	}

	write() {
		if (!this.dirty) return;
		this.dirty = false;
		const files = Array.from(this.files).map(file => {
			return `import "${file}";`;
		});
		fs.writeFileSync(this.file, files.join("\n"));
	}

	touch() {
		fs.writeFileSync(this.file, "");
	}
}
