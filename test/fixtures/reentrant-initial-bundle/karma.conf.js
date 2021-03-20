const { promises: fs } = require("fs");
const { baseConfig } = require("../../base.karma.conf");

module.exports = function (config) {
	let setups = 0;
	config.set({
		...baseConfig,

		esbuild: {
			// Make bundles to happen immediately. In large projects, karma can spend
			// huge amount of time calculating SHAs of file contents in between calls
			// to our preprocessor. We need to simulate that "took too long" behavior.
			bundleDelay: -1,

			plugins: [
				{
					name: "delayer",

					setup(build) {
						if (setups++ > 0) {
							// We called setup twice! This is likely because we rebuilt before
							// the initial build was done.
							throw new Error(`setup #${setups}`);
						}

						build.onLoad({ filter: /.*/, namespace: "" }, async ({ path }) => {
							// Insert an arbitrary delay to make the initial build take longer
							// than bundleDelay.
							await new Promise(resolve => setTimeout(resolve, 10));
							return { contents: await fs.readFile(path) };
						});
					},
				},
			],
		},
	});
};
