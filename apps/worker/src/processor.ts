import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { CodeExecutionJob } from "@ai-hiring-platform/events";
import { assertLanguageAllowed, buildDockerArgs, runDocker, type SupportedLanguage } from "./docker";
import { buildProgram, extractResults, parseHarness } from "./harness";

type Database = PrismaClient & Record<string, any>;

function message(error: unknown): string {
  if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") return "Docker CLI is unavailable";
  return error instanceof Error ? error.message.slice(0, 2_000) : "Unknown execution failure";
}

class ExecutionTimeoutError extends Error {}

export function selectExecutionHarness(publicTests: unknown, hiddenTests: unknown, isFinal: boolean) {
  const publicHarness = parseHarness(publicTests);
  const hiddenHarness = isFinal ? parseHarness(hiddenTests) : { tests: [] };
  return { tests: [...publicHarness.tests, ...hiddenHarness.tests] };
}

export async function processCodeExecution(prisma: Database, job: CodeExecutionJob): Promise<void> {
  const startedAt = new Date();
  let workspace: string | undefined;
  try {
    const execution = await prisma.codeExecution.findUnique({ where: { id: job.executionId } });
    if (!execution || execution.submissionId !== job.submissionId) throw new Error("Execution job does not match its submission");
    const submission = await prisma.codeSubmission.findUnique({ where: { id: job.submissionId } });
    if (!submission || submission.challengeId !== job.challengeId) throw new Error("Submission job does not match its challenge");
    const challenge = await prisma.codingChallenge.findUnique({ where: { id: job.challengeId } });
    if (!challenge) throw new Error("Coding challenge not found");

    const language = String(submission.language).toLowerCase();
    assertLanguageAllowed(language, challenge.allowedLanguages as string[]);

    await prisma.$transaction([
      prisma.codeExecution.update({ where: { id: execution.id }, data: { status: "RUNNING" } }),
      prisma.codeSubmission.update({ where: { id: submission.id }, data: { status: "RUNNING" } }),
    ]);

    const harness = selectExecutionHarness(challenge.publicTests, challenge.hiddenTests, submission.isFinal);
    if (harness.tests.length === 0 || harness.tests.length > 100) throw new Error("Challenge must contain 1 to 100 tests");
    workspace = await mkdtemp(join(tmpdir(), "code-execution-"));
    const extension: Record<SupportedLanguage, string> = { javascript: "js", typescript: "ts", python: "py" };
    const program = buildProgram(language, submission.code, harness);
    await writeFile(join(workspace, `program.${extension[language]}`), program, { encoding: "utf8", mode: 0o400 });

    const limitMs = Math.max(500, Math.min(30_000, Number(challenge.timeLimitMs ?? 5_000)));
    const args = buildDockerArgs({ language, workspace, memoryMb: Number(challenge.memoryLimitMb ?? 128), containerName: `code-execution-${execution.id}` });
    const result = await runDocker(args, limitMs + 1_000);
    const completedAt = new Date();
    if (result.timedOut) throw new ExecutionTimeoutError(`Execution exceeded the ${limitMs}ms time limit`);
    if (result.exitCode !== 0) throw new Error(result.stderr || `Container exited with status ${result.exitCode}`);
    const testResults = extractResults(result.stdout);
    const passedTests = testResults.tests.filter((test) => test.passed).length;
    const candidateStdout = result.stdout.split(/\r?\n/).filter((line) => !line.startsWith("__RESULT__")).join("\n");
    await prisma.$transaction([
      prisma.codeExecution.update({
        where: { id: execution.id },
        data: {
          status: "COMPLETED",
          stdout: candidateStdout.slice(-100_000),
          stderr: result.stderr.slice(-100_000),
          exitCode: result.exitCode,
          passedTests,
          totalTests: testResults.tests.length,
          durationMs: completedAt.getTime() - startedAt.getTime(),
        },
      }),
      prisma.codeSubmission.update({ where: { id: submission.id }, data: { status: "COMPLETED" } }),
    ]);
  } catch (error) {
    const completedAt = new Date();
    const errorMessage = message(error);
    const status = error instanceof ExecutionTimeoutError ? "TIMEOUT" : "FAILED";
    await prisma.$transaction([
      prisma.codeExecution.updateMany({
        where: { id: job.executionId },
        data: { status, error: errorMessage, stderr: errorMessage, durationMs: completedAt.getTime() - startedAt.getTime() },
      }),
      prisma.codeSubmission.updateMany({ where: { id: job.submissionId }, data: { status } }),
    ]);
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true });
  }
}
