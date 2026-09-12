import { selectExecutionHarness } from "./processor";

describe("code execution test visibility", () => {
  const publicTests = { tests: [{ name: "public", input: [1], expected: 1 }] };
  const hiddenTests = { tests: [{ name: "hidden", input: [2], expected: 2 }] };

  it("uses public tests only for a run", () => {
    expect(selectExecutionHarness(publicTests, hiddenTests, false).tests.map((test) => test.name)).toEqual(["public"]);
  });

  it("adds hidden tests only for a final submission", () => {
    expect(selectExecutionHarness(publicTests, hiddenTests, true).tests.map((test) => test.name)).toEqual(["public", "hidden"]);
  });
});
