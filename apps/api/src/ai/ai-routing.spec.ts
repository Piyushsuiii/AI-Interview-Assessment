import { preferredProviderFor } from "./ai-routing";

describe("hybrid AI routing", () => {
  const config = (mode?: string) => ({ get: jest.fn().mockReturnValue(mode) }) as never;

  it("routes fast work to Gemini in hybrid mode", () => {
    expect(preferredProviderFor(config("hybrid"), "fast")).toBe("gemini");
  });

  it("routes reasoning work to OpenAI in hybrid mode", () => {
    expect(preferredProviderFor(config("hybrid"), "reasoning")).toBe("openai");
  });

  it("honors a fixed provider mode", () => {
    expect(preferredProviderFor(config("gemini"), "reasoning")).toBe("gemini");
    expect(preferredProviderFor(config("openai"), "fast")).toBe("openai");
  });
});
