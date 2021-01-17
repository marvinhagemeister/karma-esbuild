import { foo } from "./sub/dep1";

describe("simple", () => {
	it("should work", () => {
		return foo();
	});
});
