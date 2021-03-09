const { baseConfig } = require("../../base.karma.conf");

module.exports = function (config) {
	config.set({
		...baseConfig,
		files: [
			"files/**/main-a.js",
			{ pattern: "files/**/main-b.js", watched: true },
		],
	});
};
