import { assertLanguageAllowed, buildDockerArgs } from "./docker";

describe("Docker command construction", () => {
  it("applies isolation and resource restrictions", () => {
    const args = buildDockerArgs({ language: "javascript", workspace: "C:\\temp\\job", memoryMb: 128 });
    expect(args).toEqual(expect.arrayContaining(["--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "64"]));
    expect(args.join(" ")).not.toContain("--env");
    expect(args).toContain("node:22.14.0-alpine3.21");
  });

  it("rejects languages without a fixed runtime", () => {
    expect(() => buildDockerArgs({ language: "ruby", workspace: "/tmp/job", memoryMb: 128 })).toThrow("Unsupported execution language");
  });

  it("rejects a supported language not allowed by the challenge", () => {
    expect(() => assertLanguageAllowed("python", ["javascript", "typescript"])).toThrow("not allowed by the challenge");
  });
});
