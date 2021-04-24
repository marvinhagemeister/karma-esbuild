import { foo } from "./dep1";

describe("B", () => {
	it("should work", () => {
		if (foo() !== 42) {
			throw new Error("fail");
		}
	});
});
