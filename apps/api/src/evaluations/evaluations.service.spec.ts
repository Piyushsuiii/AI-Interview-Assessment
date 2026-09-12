import { BadRequestException, ConflictException } from "@nestjs/common";
import { evaluationRecommendation, EvaluationsService } from "./evaluations.service";

const criterion = (criterionId: string, score: number | null, evidenceIds: string[] = [criterionId.replace("question", "answer")]) => ({
  criterionId,
  score,
  assessment: "Assessment grounded in the submitted response.",
  evidenceIds,
});

const evaluationInput = () => ({
  variables: {},
  interviewId: "interview-1",
  candidateId: "candidate-1",
  criteria: [
    { id: "question-1", name: "TypeScript", description: "First", weight: 3, maxScore: 10, required: true },
    { id: "question-2", name: "Communication", description: "Second", weight: 1, maxScore: 10, required: true },
  ],
  sources: [
    { id: "answer-1", text: "first answer", modality: "TEXT", questionId: "question-1", answerId: "answer-1" },
    { id: "answer-2", text: "second answer", modality: "TEXT", questionId: "question-2", answerId: "answer-2" },
  ],
});

const questions = [
  { id: "question-1", answer: { id: "answer-1", text: "first answer" } },
  { id: "question-2", answer: { id: "answer-2", text: "second answer" } },
];

const aiOutput = (criteria: ReturnType<typeof criterion>[]) => ({
  interviewId: "interview-1",
  candidateId: "candidate-1",
  criteria,
  recommendation: "hold" as const,
  rationale: "Rationale",
  limitations: [],
});

describe("EvaluationsService", () => {
  it("does not evaluate an interview before candidate completion", async () => {
    const prisma = {
      evaluation: { findFirst: jest.fn().mockResolvedValue(null) },
      interview: { findFirst: jest.fn().mockResolvedValue({ state: "CODING" }) },
    };
    const service = new EvaluationsService(prisma as never, {} as never);

    await expect(service.evaluate("org-1", "interview-1", { force: false }, "user-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects AI evidence IDs outside the sanitized context", () => {
    const service = new EvaluationsService({} as never, { get: jest.fn() } as never);
    const output = {
      score: 70,
      confidence: 0.8,
      recommendation: "HIRE" as const,
      summary: "Grounded summary",
      strengths: ["Clear answer"],
      weaknesses: ["Limited detail"],
      competencies: [{
        name: "TypeScript",
        score: 70,
        confidence: 0.8,
        summary: "Good",
        evidence: [{ questionId: "question-other", answerId: "answer-other", excerpt: "claim", rationale: "reason" }],
      }],
    };

    expect(() => service.assertEvidenceGrounded(output, [
      { id: "question-1", answer: { id: "answer-1", text: "actual answer" } },
    ])).toThrow(BadRequestException);
  });

  it("writes an immutable override audit record with tenant and reason", async () => {
    const tx = {
      evaluation: {
        findFirst: jest.fn().mockResolvedValue({ id: "evaluation-1", score: 60, recommendation: "MIXED" }),
        update: jest.fn().mockResolvedValue({ id: "evaluation-1", overrideScore: 75 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new EvaluationsService(prisma as never, { get: jest.fn() } as never);

    await service.override("org-1", "interview-1", { recommendation: "HIRE", reason: "Reviewed against the approved scoring rubric." }, "user-1");

    expect(tx.evaluation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { interviewId: "interview-1", interview: { organizationId: "org-1" }, status: "COMPLETED" },
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      organizationId: "org-1",
      userId: "user-1",
      action: "evaluation.override",
      metadata: expect.objectContaining({ reason: "Reviewed against the approved scoring rubric." }),
    }) });
  });

  it("rejects duplicate criterion results", () => {
    const service = new EvaluationsService({} as never, {} as never);

    expect(() => (service as any).toEvaluationOutput(
      aiOutput([criterion("question-1", 80), criterion("question-1", 70)]),
      evaluationInput(),
      questions,
    )).toThrow(expect.objectContaining({ response: expect.objectContaining({ code: "DUPLICATE_EVALUATION_CRITERION" }) }));
  });

  it("rejects omitted required evaluated questions", () => {
    const service = new EvaluationsService({} as never, {} as never);

    expect(() => (service as any).toEvaluationOutput(
      aiOutput([criterion("question-1", 80)]),
      evaluationInput(),
      questions,
    )).toThrow(expect.objectContaining({ response: expect.objectContaining({
      code: "INCOMPLETE_EVALUATION_CRITERIA",
      missingCriterionIds: ["question-2"],
    }) }));
  });

  it("uses authored weight and max score rather than an unweighted mean", () => {
    const service = new EvaluationsService({} as never, {} as never);

    const output = (service as any).toEvaluationOutput(
      aiOutput([criterion("question-1", 100), criterion("question-2", 0)]),
      evaluationInput(),
      questions,
    );

    expect(output.score).toBe(75);
    expect(output.recommendation).toBe("HIRE");
  });

  it("keeps aggregated confidence within zero and one", () => {
    const service = new EvaluationsService({} as never, {} as never);
    const repeatedEvidence = Array.from({ length: 50 }, () => "answer-1");
    const input = evaluationInput();
    input.sources = [{ id: "answer-1", text: "first answer", modality: "TEXT", questionId: "question-1", answerId: "answer-1" }];
    input.criteria = [input.criteria[0]];

    const output = (service as any).toEvaluationOutput(
      aiOutput([criterion("question-1", 90, repeatedEvidence)]),
      input,
      [questions[0]],
    );

    expect(output.confidence).toBe(1);
    expect(output.competencies[0].confidence).toBe(1);
  });

  it("includes immutable authored criteria, job requirements, and modality evidence in the prompt context", () => {
    const service = new EvaluationsService({} as never, {} as never);
    const interview = {
      id: "interview-1",
      candidate: { id: "candidate-1" },
      assessment: {
        activeVersion: { questions: [{ questionVersionId: "version-1", weight: 2, required: true }] },
        job: { skills: [{ name: "TypeScript", importance: "REQUIRED" }] },
      },
      questions: [{
        id: "question-1",
        questionVersionId: "version-1",
        type: "TEXT",
        prompt: "Explain narrowing",
        maxScore: 20,
        questionVersion: { expectedAnswer: "Discuss control flow", rubric: { accuracy: 5 }, skills: ["TypeScript"], maxScore: 20 },
        answer: { id: "answer-1", text: "Control flow narrows a union", submittedAt: new Date() },
        codingChallenge: null,
        systemDesignSubmission: null,
      }],
      integrityEvents: [],
    };

    const context = (service as any).buildContext(interview);
    const prompt = (service as any).buildPromptInput(interview, context);

    expect(prompt.variables.criteria[0]).toMatchObject({
      expectedAnswer: "Discuss control flow",
      rubric: { accuracy: 5 },
      skills: ["TypeScript"],
      weight: 2,
      required: true,
    });
    expect(prompt.variables.jobSkillRequirements).toEqual([{ name: "TypeScript", importance: "REQUIRED" }]);
    expect(prompt.variables.evidence[0]).toMatchObject({ modality: "TEXT", questionId: "question-1", answerId: "answer-1" });
  });

  it("persists FAILED state when no provider is available", async () => {
    const evaluation = { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) };
    const prisma = {
      evaluation,
      interview: { findFirst: jest.fn().mockResolvedValue({
        id: "interview-1",
        state: "EVALUATION",
        candidate: { id: "candidate-1" },
        assessment: {
          activeVersion: { questions: [{ questionVersionId: "version-1", weight: 1, required: true }] },
          job: { skills: [] },
        },
        questions: [{
          id: "question-1",
          questionVersionId: "version-1",
          type: "TEXT",
          prompt: "Question",
          maxScore: 10,
          questionVersion: { expectedAnswer: "Expected", rubric: null, skills: [], maxScore: 10 },
          answer: { id: "answer-1", text: "Answer", submittedAt: new Date() },
          codingChallenge: null,
          systemDesignSubmission: null,
        }],
        integrityEvents: [],
      }) },
    };
    const service = new EvaluationsService(prisma as never, { get: jest.fn().mockReturnValue(undefined) } as never);

    await expect(service.evaluate("org-1", "interview-1", { force: false }, "user-1")).rejects.toMatchObject({
      response: expect.objectContaining({ code: "AI_NOT_CONFIGURED" }),
    });
    expect(evaluation.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      create: expect.objectContaining({ status: "PROCESSING" }),
    }));
    expect(evaluation.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      create: expect.objectContaining({ status: "FAILED" }),
      update: expect.objectContaining({ status: "FAILED" }),
    }));
  });

  it.each([
    [85, 0.8, 1, "STRONG_HIRE"],
    [70, 0.8, 1, "HIRE"],
    [60, 0.8, 1, "LEAN_HIRE"],
    [45, 0.8, 1, "LEAN_NO_HIRE"],
    [44.99, 0.8, 1, "NO_HIRE"],
    [100, 0.49, 1, "NEEDS_REVIEW"],
    [100, 1, 0.69, "NEEDS_REVIEW"],
  ])("maps score %s, confidence %s, coverage %s to %s", (score, confidence, coverage, expected) => {
    expect(evaluationRecommendation(score as number, confidence as number, coverage as number)).toBe(expected);
  });
});
