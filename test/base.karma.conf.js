const localLaunchers = {
	ChromeCustom: {
		base: "Chrome",
		flags: [
			// See https://chromium.googlesource.com/chromium/src/+/lkgr/headless/README.md
			"--headless",
			"--disable-gpu",
			"--no-gpu",
			// Without a remote debugging port, Google Chrome exits immediately.
			"--remote-debugging-port=9333",
		],
	},
};

module.exports = {
	baseConfig: {
		plugins: [
			"karma-mocha",
			"karma-mocha-reporter",
			"karma-chrome-launcher",
			"karma-sourcemap-loader",
			require("../src/index"),
		],

		browsers: Object.keys(localLaunchers),
		customLaunchers: localLaunchers,

		frameworks: ["mocha"],
		reporters: ["mocha"],
		browsers: ["ChromeCustom"],

		basePath: "",
		files: [{ pattern: "files/**/*main-*.js", watched: false }],
		exclude: [],

		preprocessors: {
			"**/*.{js,ts}": ["esbuild"],
		},
	},
};
