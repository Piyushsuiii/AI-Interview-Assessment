import { ConflictException } from "@nestjs/common";
import { CodingService } from "./coding.service";

describe("CodingService current-question authorization", () => {
  it("rejects a coding question that is not the first unanswered ordered question", async () => {
    const prisma = {
      interview: { findUnique: jest.fn().mockResolvedValue({
        id: "interview-1",
        state: "CODING",
        invitationExpiresAt: new Date(Date.now() + 60_000),
        questions: [
          { id: "q1", type: "TECHNICAL", prompt: "First", order: 1, maxScore: 10, answer: null, systemDesignSubmission: null, codingChallenge: null },
          { id: "q2", type: "CODING", prompt: "Code", order: 2, maxScore: 10, answer: null, systemDesignSubmission: null, codingChallenge: { submissions: [] } },
        ],
      }) },
      interviewQuestion: { findFirst: jest.fn() },
    };
    const service = new CodingService(prisma as never, { close: jest.fn() } as never);

    await expect(service.getChallenge("token", "q2")).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.interview.findUnique.mock.calls[0][0].select).not.toHaveProperty("currentQuestionId");
    expect(prisma.interviewQuestion.findFirst).not.toHaveBeenCalled();
  });
});
