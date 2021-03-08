const { baseConfig } = require("../../base.karma.conf");
const path = require("path");

let envPlugin = {
	name: "env",
	setup(build) {
		// Intercept import paths called "env" so esbuild doesn't attempt
		// to map them to a file system location. Tag them with the "env-ns"
		// namespace to reserve them for this plugin.
		build.onResolve({ filter: /^env$/ }, args => ({
			path: args.path,
			namespace: "env-ns",
		}));

		// We're going to hook into esbuild and replace the "env" module loaded
		// by the tests with our expected results.
		build.onLoad({ filter: /^env$/, namespace: "env-ns" }, () => ({
			contents: JSON.stringify([
				path.join(
					process.cwd(),
					"test",
					"fixtures",
					"sourcemap",
					"files",
					"sub",
					"dep2.js",
				),
				path.join(
					process.cwd(),
					"test",
					"fixtures",
					"sourcemap",
					"files",
					"sub",
					"main-b.js",
				),
			]),
			loader: "json",
		}));
	},
};

module.exports = function (config) {
	config.set({
		...baseConfig,
		preprocessors: {
			"**/*.js": ["esbuild", "sourcemap"],
		},

		esbuild: {
			plugins: [envPlugin],
		},
	});
};
