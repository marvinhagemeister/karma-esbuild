const { baseConfig } = require("../../base.karma.conf");

module.exports = function (config) {
	config.set({
		...baseConfig,
		esbuild: {
			singleBundle: false,
		},
	});
};
