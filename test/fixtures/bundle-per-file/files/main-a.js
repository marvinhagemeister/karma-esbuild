import { foo } from "./dep1";

describe("Suite A", () => {
	it("should work", () => {
		return foo();
	});
});
