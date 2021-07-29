const { baseConfig } = require("../../base.karma.conf");
const path = require("path");

const expectedSources = [
	path.join(process.cwd(), "test", "fetch-polyfill.js"),
	path.join(
		process.cwd(),
		"test",
		"fixtures",
		"sourcemap-base",
		"files",
		"main-a.js",
	),
].sort();

const envPlugin = {
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
			contents: JSON.stringify(expectedSources),
			loader: "json",
		}));
	},
};

module.exports = function (config) {
	console.log(__dirname);
	config.set({
		...baseConfig,
		preprocessors: {
			"files/**/*.js": ["esbuild"],
		},

		esbuild: {
			singleBundle: false,
			plugins: [envPlugin],
		},
	});
};
