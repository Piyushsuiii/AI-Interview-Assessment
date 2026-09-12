type QuestionEvidence = {
  id: string;
  type: string;
  prompt: string;
  order: number;
  maxScore: number;
  answer: { id: string } | null;
  systemDesignSubmission: { id: string } | null;
  codingChallenge: { submissions: Array<{ id: string }> } | null;
};

export const progressionQuestionInclude = {
  answer: { select: { id: true } },
  systemDesignSubmission: { select: { id: true } },
  codingChallenge: {
    select: { submissions: { where: { isFinal: true }, take: 1, select: { id: true } } },
  },
} as const;

export function isQuestionAnswered(question: QuestionEvidence): boolean {
  if (question.type === "CODING") return Boolean(question.codingChallenge?.submissions.length);
  if (question.type === "SYSTEM_DESIGN") return Boolean(question.systemDesignSubmission);
  return Boolean(question.answer);
}

export function currentUnansweredQuestion<T extends QuestionEvidence>(questions: T[]): T | undefined {
  return questions.find((question) => !isQuestionAnswered(question));
}

function stateForQuestion(type?: string): "TECHNICAL" | "CODING" | "SYSTEM_DESIGN" | "BEHAVIORAL" {
  if (type === "CODING") return "CODING";
  if (type === "SYSTEM_DESIGN") return "SYSTEM_DESIGN";
  if (type === "BEHAVIORAL") return "BEHAVIORAL";
  return "TECHNICAL";
}

export async function advanceInterview(
  tx: any,
  interviewId: string,
  event: { questionId: string; evidenceId: string },
) {
  const interview = await tx.interview.findUnique({
    where: { id: interviewId },
    include: {
      session: true,
      questions: { orderBy: { order: "asc" }, include: progressionQuestionInclude },
    },
  });
  if (!interview) throw new Error("Interview disappeared while advancing progression");

  const next = currentUnansweredQuestion(interview.questions);
  const answeredQuestions = interview.questions.filter(isQuestionAnswered).length;
  const totalQuestions = interview.questions.length;
  const completed = !next;
  const nextState = completed ? "EVALUATION" : stateForQuestion(next.type);
  const now = new Date();

  await tx.interview.update({
    where: { id: interview.id },
    data: {
      state: nextState,
      currentSection: nextState,
      progress: totalQuestions ? (answeredQuestions / totalQuestions) * 100 : 100,
      completedAt: null,
    },
  });
  if (interview.session) {
    const session = await tx.interviewSession.update({
      where: { id: interview.session.id },
      data: { state: nextState, lastEventSequence: { increment: 1 }, completedAt: completed ? now : null },
    });
    await tx.interviewEvent.create({
      data: {
        interviewId: interview.id,
        sequence: session.lastEventSequence,
        type: "ANSWER_SUBMITTED",
        payload: event,
        occurredAt: now,
      },
    });
  }
  return {
    completed,
    state: nextState,
    progress: { answeredQuestions, totalQuestions },
    nextQuestion: next ? { id: next.id, type: next.type, prompt: next.prompt, order: next.order, maxScore: next.maxScore } : null,
  };
}
