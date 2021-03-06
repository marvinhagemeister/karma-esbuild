export function fetchPolyfill(input) {
	return new Promise(function (resolve, reject) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", input, true);
		xhr.onreadystatechange = () => {
			if (xhr.readyState == /* COMPLETE */ 4) {
				resolve({
					status: xhr.status,
					text: () => {
						return Promise.resolve(xhr.responseText);
					},
				});
			}
		};
		xhr.onerror = () => {
			reject(new Error("Network failure"));
		};
		xhr.onabort = () => {
			reject(new Error("Request aborted"));
		};
		xhr.send();
	});
}
