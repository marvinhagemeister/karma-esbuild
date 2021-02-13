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
	const pending = new Map<string, CacheCb[]>();
	const lastUsed = new Map<string, number>();

	async function set(key: string, item: CacheItem) {
		cache.set(key, item);

		const waitingFns = pending.get(key);
		pending.set(key, []);
		lastUsed.set(key, item.time);

		if (waitingFns) {
			await Promise.all(waitingFns.map(fn => fn(item)));
		}
	}

	async function get(key: string): Promise<CacheItem> {
		let result = cache.get(key);
		const last = lastUsed.get(key) || 0;
		if (result && result.time >= last) {
			lastUsed.set(key, result.time);
			return result;
		}

		return new Promise(resolve => {
			let fns = pending.get(key) || [];
			fns.push(resolve);
			pending.set(key, fns);
		});
	}

	function has(key: string) {
		return cache.has(key) || pending.has(key);
	}

	return {
		set,
		get,
		has,
	};
}
