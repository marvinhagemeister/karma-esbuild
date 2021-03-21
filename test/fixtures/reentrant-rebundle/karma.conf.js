const { promises: fs } = require("fs");
const { baseConfig } = require("../../base.karma.conf");
const path = require("path");

module.exports = function (config) {
	config.set({
		...baseConfig,

		esbuild: {
			bundleDelay: -1,

			plugins: [
				{
					name: "delayer",

					setup(build) {
						build.onLoad(
							{ filter: /.*/, namespace: "" },
							async ({ path: filePath }) => {
								console.log(`file: ${path.basename(filePath)}`);
								// Insert an arbitrary delay to make the build take longer than
								// bundleDelay.
								await new Promise(resolve => setTimeout(resolve, 50));
								return { contents: await fs.readFile(filePath) };
							},
						);
					},
				},
			],
		},
	});
};
