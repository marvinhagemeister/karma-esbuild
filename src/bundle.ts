import * as os from "os";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { SourceMapPayload } from "module";

interface BundledFile {
	code: string;
	map: SourceMapPayload;
}

function random(length: number) {
	return crypto.randomBytes(length).toString("hex");
}

export class Bundle {
	private dir = os.tmpdir();
	private files = new Set<string>();
	private item: BundledFile = {
		code: "",
		map: {} as SourceMapPayload,
	};
	file = path.join(this.dir, `${random(16)}-bundle.js`);

	addFile(file: string) {
		const normalized = path
			.relative(this.dir, file)
			.replace(/\\/g, path.posix.sep);
		this.files.add(normalized);
	}

	generate() {
		const files = Array.from(this.files).map(file => {
			return `import "${file}";`;
		});
		return files.join("\n");
	}

	write(item: BundledFile) {
		this.item = item;
	}

	read() {
		return this.item;
	}

	touch() {
		fs.writeFileSync(this.file, "");
	}
}
