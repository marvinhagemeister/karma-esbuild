module.exports = {
	baseConfig: {
		plugins: [
			"karma-mocha",
			"karma-mocha-reporter",
			"karma-jsdom-launcher",
			require("../src/index"),
		],

		browsers: ["jsdom"],

		frameworks: ["mocha"],
		reporters: ["mocha"],

		basePath: "",
		files: [{ pattern: "files/**/*main-*.js", watched: false }],
		exclude: [],

		preprocessors: {
			"files/**/*.{js,ts}": ["esbuild"],
		},
	},
};
