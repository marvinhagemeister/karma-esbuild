import * as os from "os";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";

function random(length: number) {
	return crypto.randomBytes(length).toString("hex");
}

export class Bundle {
	dir = os.tmpdir();
	file = path.join(this.dir, `${random(16)}-bundle.js`);
	files = new Set<string>();

	addFile(file: string) {
		this.files.add(file);
	}

	generate() {
		const files = Array.from(this.files).map(file => {
			return `import "${path.relative(this.file, file)}";`;
		});
		return files.join("\n");
	}

	write(contents: string) {
		fs.writeFileSync(this.file, contents);
	}
}
