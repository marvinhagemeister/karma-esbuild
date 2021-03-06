describe("simple", () => {
	it("should work", () => {
		var test = () => {};
		if (test.toString().includes("=>")) {
			throw new Error(
				"Looks like target setting failed to transpile arrow into regular functions",
			);
		}
	});
});
