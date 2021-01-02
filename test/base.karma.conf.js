module.exports = {
	baseConfig: {
		plugins: [
			"karma-mocha",
			"karma-mocha-reporter",
			"karma-chrome-launcher",
			require("../src/index"),
		],

		frameworks: ["mocha"],
		reporters: ["mocha"],
		browsers: ["ChromeHeadless"],

		basePath: "",
		files: [{ pattern: "files/main-*.js", watched: false }],
		exclude: [],

		preprocessors: {
			"**/*.js": ["esbuild"],
		},
	},
};
