const { promises: fs } = require("fs");
const { baseConfig } = require("../../base.karma.conf");
const path = require("path");

module.exports = function (config) {
	config.set({
		...baseConfig,
		exclude: ["files/excluded/*"],
	});
};
