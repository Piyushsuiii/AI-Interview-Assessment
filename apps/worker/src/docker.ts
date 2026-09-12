import { spawn } from "node:child_process";

export const SUPPORTED_LANGUAGES = ["javascript", "typescript", "python"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const RUNTIMES: Record<SupportedLanguage, { image: string; command: string[] }> = {
  javascript: { image: "node:22.14.0-alpine3.21", command: ["node", "/workspace/program.js"] },
  typescript: {
    image: "node:22.14.0-alpine3.21",
    command: ["node", "--experimental-strip-types", "/workspace/program.ts"],
  },
  python: { image: "python:3.13.2-alpine3.21", command: ["python", "-I", "/workspace/program.py"] },
};

export function assertSupportedLanguage(language: string): asserts language is SupportedLanguage {
  if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(language)) {
    throw new Error(`Unsupported execution language: ${language}`);
  }
}

export function assertLanguageAllowed(language: string, allowedLanguages: string[]): asserts language is SupportedLanguage {
  assertSupportedLanguage(language);
  if (!allowedLanguages.map((item) => item.toLowerCase()).includes(language)) {
    throw new Error("Submission language is not allowed by the challenge");
  }
}

export function buildDockerArgs(input: {
  language: string;
  workspace: string;
  memoryMb: number;
  cpuLimit?: number;
  containerName?: string;
}): string[] {
  assertSupportedLanguage(input.language);
  const runtime = RUNTIMES[input.language];
  const memoryMb = Math.max(32, Math.min(512, Math.trunc(input.memoryMb)));
  const cpuLimit = Math.max(0.1, Math.min(1, input.cpuLimit ?? 0.5));
  return [
    "run",
    "--rm",
    ...(input.containerName ? ["--name", input.containerName] : []),
    "--network", "none",
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--pids-limit", "64",
    "--memory", `${memoryMb}m`,
    "--memory-swap", `${memoryMb}m`,
    "--cpus", String(cpuLimit),
    "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=16m",
    "--mount", `type=bind,src=${input.workspace},dst=/workspace,readonly`,
    "--workdir", "/workspace",
    runtime.image,
    ...runtime.command,
  ];
}

export type ProcessResult = { exitCode: number | null; stdout: string; stderr: string; timedOut: boolean };

export function runDocker(args: string[], timeoutMs: number): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const append = (current: string, chunk: Buffer) => (current + chunk.toString("utf8")).slice(-1_000_000);
    child.stdout.on("data", (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk: Buffer) => { stderr = append(stderr, chunk); });
    child.once("error", reject);
    const timer = setTimeout(() => {
      timedOut = true;
      const nameIndex = args.indexOf("--name");
      const containerName = nameIndex >= 0 ? args[nameIndex + 1] : undefined;
      if (containerName) {
        const killer = spawn("docker", ["kill", containerName], { stdio: "ignore", windowsHide: true });
        killer.once("error", () => child.kill("SIGKILL"));
      } else {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
  });
}
