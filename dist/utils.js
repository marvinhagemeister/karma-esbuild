"use strict";
var __createBinding =
	(this && this.__createBinding) ||
	(Object.create
		? function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				Object.defineProperty(o, k2, {
					enumerable: true,
					get: function () {
						return m[k];
					},
				});
		  }
		: function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				o[k2] = m[k];
		  });
var __setModuleDefault =
	(this && this.__setModuleDefault) ||
	(Object.create
		? function (o, v) {
				Object.defineProperty(o, "default", { enumerable: true, value: v });
		  }
		: function (o, v) {
				o["default"] = v;
		  });
var __importStar =
	(this && this.__importStar) ||
	function (mod) {
		if (mod && mod.__esModule) return mod;
		var result = {};
		if (mod != null)
			for (var k in mod)
				if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
					__createBinding(result, mod, k);
		__setModuleDefault(result, mod);
		return result;
	};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTime =
	exports.debounce =
	exports.random =
	exports.Deferred =
		void 0;
const crypto = __importStar(require("crypto"));
class Deferred {
	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
		});
	}
}
exports.Deferred = Deferred;
function random(length) {
	return crypto.randomBytes(length).toString("hex");
}
exports.random = random;
function debounce(fn, ms) {
	// This is really just for our tests. Don't do this in your tests, you'll
	// regret the constant CPU spikes.
	if (ms < 0) {
		return fn;
	}
	let timeout;
	let _deferred;
	function process() {
		const deferred = _deferred;
		_deferred = undefined;
		try {
			deferred.resolve(fn());
		} catch (e) {
			deferred.reject(e);
		}
	}
	return () => {
		_deferred || (_deferred = new Deferred());
		clearTimeout(timeout);
		timeout = setTimeout(process, ms);
		return _deferred.promise;
	};
}
exports.debounce = debounce;
function formatTime(ms) {
	let seconds = Math.floor((ms / 1000) % 60);
	let minutes = Math.floor((ms / (1000 * 60)) % 60);
	let hours = Math.floor(ms / (1000 * 60 * 60));
	let str = "";
	if (hours > 0) {
		str += `${hours}h `;
	}
	if (minutes > 0) {
		str += `${minutes}min `;
	}
	if (seconds > 0) {
		str += `${seconds}s`;
	}
	if (str === "") {
		str += `${ms}ms`;
	}
	return str;
}
exports.formatTime = formatTime;
