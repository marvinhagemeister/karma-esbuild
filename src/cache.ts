import { SourceMapPayload } from "module";

export interface CacheItem {
	file: string;
	content: string;
	mapFile: string;
	mapText: SourceMapPayload;
	mapContent: string;
	time: number;
}

export type CacheCb = (item: CacheItem) => void;

export function newCache() {
	const cache = new Map<string, CacheItem>();
	const pending = new Map<
		string,
		{ reject: (err?: Error) => void; resolve: CacheCb }[]
	>();

	function set(key: string, item: CacheItem) {
		cache.set(key, item);

		const waitingFns = pending.get(key);
		if (waitingFns) {
			waitingFns.forEach(fn => fn.resolve(item));
			pending.delete(key);
		}
	}

	async function get(key: string): Promise<CacheItem> {
		const result = cache.get(key);
		if (result) {
			return result;
		}

		return new Promise((resolve, reject) => {
			const fns = pending.get(key) || [];
			fns.push({ resolve, reject });
			pending.set(key, fns);
		});
	}

	function has(key: string) {
		return cache.has(key) || pending.has(key);
	}

	function clear() {
		cache.clear();
		pending.forEach(item => {
			item.forEach(p => p.reject());
		});
		pending.clear();
	}

	return {
		set,
		get,
		has,
		clear,
	};
}
