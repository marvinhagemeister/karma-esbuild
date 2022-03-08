import * as crypto from "crypto";

export type Log = Pick<Console, "info" | "error">;
export class Deferred<T> {
	declare promise: Promise<T>;
	declare resolve: (value: T | PromiseLike<T>) => void;
	declare reject: (reason: Error) => void;

	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
		});
	}
}

export function random(length: number) {
	return crypto.randomBytes(length).toString("hex");
}

export function debounce<R>(fn: () => R, ms: number) {
	// This is really just for our tests. Don't do this in your tests, you'll
	// regret the constant CPU spikes.
	if (ms < 0) {
		return fn;
	}

	let timeout: NodeJS.Timeout;
	let _deferred: Deferred<R> | undefined;
	function process() {
		const deferred = _deferred!;
		_deferred = undefined;
		try {
			deferred.resolve(fn());
		} catch (e) {
			deferred.reject(e as Error);
		}
	}
	return (): Promise<R> => {
		_deferred ||= new Deferred();
		clearTimeout(timeout);
		timeout = setTimeout(process, ms);
		return _deferred.promise;
	};
}

export function formatTime(ms: number): string {
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
