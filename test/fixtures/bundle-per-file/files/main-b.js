import { foo } from "./dep1";

describe("Suite B", () => {
	it("should work", () => {
		return foo();
	});
});
