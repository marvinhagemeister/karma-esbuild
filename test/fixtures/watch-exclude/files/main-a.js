import { foo } from "./dep1";

describe("simple", () => {
	it("should work", () => {
		if (foo() !== "excluded") {
			throw new Error("fail: foo() is " + foo());
		}
	});
});
