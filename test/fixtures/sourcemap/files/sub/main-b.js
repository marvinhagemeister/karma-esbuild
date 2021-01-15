import { bar } from "./dep2";

describe("simple", () => {
	it("should work", () => {
		return bar();
	});
});
