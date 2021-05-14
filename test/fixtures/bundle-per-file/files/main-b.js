import { foo } from "./dep1";

describe("Suite B", () => {
	it("should work", () => {
		if (foo() !== 0) {
			throw new Error("fail");
		}
	});
});
