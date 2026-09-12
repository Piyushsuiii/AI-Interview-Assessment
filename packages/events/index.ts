export const CODE_EXECUTION_QUEUE = "code-execution" as const;
export const CODE_EXECUTION_JOB = "execute" as const;
export type CodeExecutionQueueName = typeof CODE_EXECUTION_QUEUE;
export type CodeExecutionJobName = typeof CODE_EXECUTION_JOB;

/** Queue messages contain database identifiers only. Source and tests never enter Redis. */
export type CodeExecutionJob = {
  executionId: string;
  submissionId: string;
  challengeId: string;
};
