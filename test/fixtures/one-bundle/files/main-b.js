import { foo } from "./dep1";

describe("B", () => {
	it("should work B", () => {
		if (foo() !== 42) {
			throw new Error("fail");
		}
	});
});
