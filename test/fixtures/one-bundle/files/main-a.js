import { foo } from "./dep1";

describe("A", () => {
	it("should work A", () => {
		if (foo() !== 42) {
			throw new Error("fail");
		}
	});
});
