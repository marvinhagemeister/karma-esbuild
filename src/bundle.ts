import * as os from "os";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { SourceMapPayload } from "module";

interface BundledFile {
	code: string;
	parsedMap: SourceMapPayload;
	map: string;
}

function random(length: number) {
	return crypto.randomBytes(length).toString("hex");
}

export class Bundle {
	private dir = os.tmpdir();
	private files = new Set<string>();
	private item: BundledFile = {
		code: "",
		parsedMap: {} as SourceMapPayload,
		map: "",
	};
	file = path.join(this.dir, `${random(16)}-bundle.js`);

	addFile(file: string) {
		this.files.add(file);
	}

	generate() {
		const files = Array.from(this.files).map(file => {
			return `import "${path.relative(this.dir, file)}";`;
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
