import path from "path";
import { onTeardown } from "pentf/runner";
import child_process from "child_process";
import { stripColors } from "kolorist";
import { assertEventually } from "pentf/assert_utils";

export async function runKarma(
	config: any,
	fixture: string,
	options: { inherit?: boolean } = {},
) {
	const app = path.join("node_modules", ".bin", "karma");
	const fixturePath = path.join(__dirname, "fixtures", fixture);
	const karmaConfig = path.join(fixturePath, "karma.conf.js");
	const output = {
		stdout: [] as string[],
		stderr: [] as string[],
	};

	const child = child_process.spawn(
		app,
		["start", "--no-single-run", karmaConfig],
		{
			stdio: options.inherit ? "inherit" : undefined,
			shell: true,
		},
	);

	if (!options.inherit) {
		await new Promise((resolve, reject) => {
			child.stderr!.on("data", s => {
				output.stderr.push(stripColors(s.toString()));
				reject();
			});
			child.stdout!.on("data", s => {
				output.stdout.push(stripColors(s.toString()));
				resolve(null);
			});
		});

		onTeardown(config, () => {
			child.kill();
		});

		await assertEventuallyProgresses(
			output.stdout,
			() => output.stdout.some(line => /server started/.test(line)),
			{
				message: "Could not find karma server started message",
			},
		);
	}

	return {
		output,
		resetLog: () => {
			output.stdout = [];
			output.stderr = [];
		},
	};
}

export async function assertEventuallyProgresses(
	stdout: string[],
	cb: () => boolean,
	options?: Parameters<typeof assertEventually>[1],
) {
	options = { ...options, timeout: 5_000 };
	while (true) {
		const { length } = stdout;
		try {
			return await assertEventually(cb, options);
		} catch (e) {
			if (stdout.length === length) {
				console.error(stdout);
				// We didn't make any progress.
				throw e;
			}
		}
	}
}
