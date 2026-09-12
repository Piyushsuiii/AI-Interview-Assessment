import { advanceInterview, currentUnansweredQuestion, isQuestionAnswered } from "./interview-progression";

const question = (overrides: Record<string, unknown>) => ({
  id: "q",
  type: "TECHNICAL",
  prompt: "Prompt",
  order: 1,
  maxScore: 10,
  answer: null,
  systemDesignSubmission: null,
  codingChallenge: null,
  ...overrides,
});

describe("authoritative interview progression", () => {
  it("derives the first unanswered question from ordered type-specific evidence", () => {
    const questions = [
      question({ id: "text", answer: { id: "answer" } }),
      question({ id: "code", type: "CODING", order: 2, codingChallenge: { submissions: [{ id: "final" }] } }),
      question({ id: "design", type: "SYSTEM_DESIGN", order: 3 }),
    ];

    expect(isQuestionAnswered(questions[1] as never)).toBe(true);
    expect(currentUnansweredQuestion(questions as never[])?.id).toBe("design");
  });

  it("moves candidate-complete interviews to EVALUATION without an early completion event", async () => {
    const interviewUpdate = jest.fn();
    const sessionUpdate = jest.fn().mockResolvedValue({ lastEventSequence: 4 });
    const eventCreate = jest.fn();
    const tx = {
      interview: {
        findUnique: jest.fn().mockResolvedValue({
          id: "interview-1",
          session: { id: "session-1" },
          questions: [question({ id: "q1", answer: { id: "answer-1" } })],
        }),
        update: interviewUpdate,
      },
      interviewSession: { update: sessionUpdate },
      interviewEvent: { create: eventCreate },
    };

    const result = await advanceInterview(tx, "interview-1", { questionId: "q1", evidenceId: "answer-1" });

    expect(result).toMatchObject({ completed: true, state: "EVALUATION" });
    expect(interviewUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: "EVALUATION" }) }));
    expect(sessionUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: "EVALUATION" }) }));
    expect(eventCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "ANSWER_SUBMITTED" }) }));
  });
});
