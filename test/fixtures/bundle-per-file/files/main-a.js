import { foo } from "./dep1";

describe("Suite A", () => {
	it("should work", () => {
		if (foo() !== 0) {
			throw new Error("fail");
		}
	});
});
