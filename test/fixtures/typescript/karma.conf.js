const { baseConfig } = require("../../base.karma.conf");

module.exports = function (config) {
	config.set({
		...baseConfig,
		files: [{ pattern: "files/**/*main-*.ts", watched: false, type: "js" }],
		esbuild: {
			singleBundle: false,
		},
	});
};
