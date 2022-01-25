import { foo } from "./dep1";

describe("simple", () => {
	it("should work", () => {
		if (foo() !== 123) {
			throw new Error("fail: foo() is " + foo());
		}
	});
});
