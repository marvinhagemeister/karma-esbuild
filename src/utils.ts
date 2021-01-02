export function debounce(fn: (...args: any[]) => any, ms: number) {
	let timeout: NodeJS.Timeout;
	return (...args: any[]): Promise<ReturnType<typeof fn>> => {
		return new Promise(resolve => {
			clearTimeout(timeout);
			timeout = setTimeout(() => resolve(fn.call(null, args)), ms);
		});
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
