"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BundlerMap = void 0;
const events_1 = require("events");
const bundle_1 = require("./bundle");
class BundlerMap {
	constructor(log, config) {
		this.potentials = new Set();
		this.bundlers = new Map();
		this.emitter = new events_1.EventEmitter();
		this.log = log;
		this.config = config;
	}
	on(name, callback) {
		this.emitter.addListener(name, callback);
	}
	addPotential(file) {
		if (this.bundlers.has(file)) return;
		this.potentials.add(file);
	}
	has(file) {
		return this.bundlers.has(file) || this.potentials.has(file);
	}
	get(file) {
		let bundler = this.bundlers.get(file);
		if (!bundler) {
			bundler = new bundle_1.Bundle(file, this.log, this.config, this.emitter);
			this.bundlers.set(file, bundler);
			this.potentials.delete(file);
		}
		return bundler;
	}
	read(file) {
		const bundler = this.get(file);
		if (bundler.isDirty()) bundler.write();
		return bundler.read();
	}
	dirty() {
		this.bundlers.forEach(b => b.dirty());
	}
	stop() {
		const promises = [...this.bundlers.values()].map(b => b.stop());
		return Promise.all(promises);
	}
}
exports.BundlerMap = BundlerMap;
