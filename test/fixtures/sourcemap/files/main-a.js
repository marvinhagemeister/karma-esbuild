import { foo } from "./dep1";

describe("simple", () => {
	it("should work", () => {
		return foo();
	});
});
