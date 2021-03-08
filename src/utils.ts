class Deferred<T> {
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

export function debounce<A extends any[], R>(
	fn: (...args: A) => R,
	ms: number,
) {
	let timeout: NodeJS.Timeout;
	let _args: A | undefined;
	let _deferred: Deferred<R> | undefined;
	function process() {
		const args = _args!;
		const deferred = _deferred!;
		_args = undefined;
		_deferred = undefined;
		try {
			deferred.resolve(fn(...args));
		} catch (e) {
			deferred.reject(e);
		}
	}
	function current() {
		_deferred ||= new Deferred();
		return _deferred.promise;
	}
	const debounced = (...args: A): Promise<R> => {
		_args = args;
		clearTimeout(timeout);
		timeout = setTimeout(process, ms);
		return current();
	};
	debounced.current = current;
	return debounced;
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
