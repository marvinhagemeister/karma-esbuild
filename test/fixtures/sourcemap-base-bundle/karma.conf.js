const { baseConfig } = require("../../base.karma.conf");

module.exports = function (config) {
	config.set({
		...baseConfig,
		basePath: undefined,
		preprocessors: {
			"files/**/*.js": ["esbuild"],
		},

		esbuild: {
			singleBundle: false,
		},
	});
};
