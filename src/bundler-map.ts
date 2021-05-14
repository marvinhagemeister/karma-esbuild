import { EventEmitter } from "events";
import { Bundle } from "./bundle";

import type esbuild from "esbuild";
import type { Log } from "./utils";

export interface BundleEvents {
	start: { type: "start"; time: number; file: string };
	stop: { type: "stop"; file: string };
	done: { type: "done"; endTime: number; startTime: number; file: string };
}

export class BundlerMap {
	private declare log: Log;
	private declare config: esbuild.BuildOptions;
	private potentials = new Set<string>();
	private bundlers = new Map<string, Bundle>();
	private emitter = new EventEmitter();

	constructor(log: Log, config: esbuild.BuildOptions) {
		this.log = log;
		this.config = config;
	}

	on<K extends keyof BundleEvents>(
		name: K,
		callback: (event: BundleEvents[K]) => void,
	) {
		this.emitter.addListener(name, callback);
	}

	addPotential(file: string) {
		if (this.bundlers.has(file)) return;
		this.potentials.add(file);
	}

	has(file: string) {
		return this.bundlers.has(file) || this.potentials.has(file);
	}

	get(file: string) {
		let bundler = this.bundlers.get(file);
		if (!bundler) {
			bundler = new Bundle(file, this.log, this.config, this.emitter);
			this.bundlers.set(file, bundler);
			this.potentials.delete(file);
		}
		return bundler;
	}

	read(file: string) {
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
