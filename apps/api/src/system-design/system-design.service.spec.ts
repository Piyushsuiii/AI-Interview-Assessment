import { ConflictException } from "@nestjs/common";
import { SystemDesignService } from "./system-design.service";

describe("SystemDesignService current-question authorization", () => {
  it("rejects a system-design question that is not the first unanswered ordered question", async () => {
    const prisma = {
      interview: { findUnique: jest.fn().mockResolvedValue({
        id: "interview-1",
        state: "SYSTEM_DESIGN",
        invitationExpiresAt: new Date(Date.now() + 60_000),
        questions: [
          { id: "q1", type: "TECHNICAL", prompt: "First", order: 1, maxScore: 10, answer: null, systemDesignSubmission: null, codingChallenge: null },
          { id: "q2", type: "SYSTEM_DESIGN", prompt: "Design", order: 2, maxScore: 10, answer: null, systemDesignSubmission: null, codingChallenge: null },
        ],
      }) },
      interviewQuestion: { findFirst: jest.fn() },
      systemDesignSubmission: { findUnique: jest.fn() },
    };
    const service = new SystemDesignService(prisma as never);

    await expect(service.get("token", "q2")).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.interview.findUnique.mock.calls[0][0].select).not.toHaveProperty("currentQuestionId");
    expect(prisma.interviewQuestion.findFirst).not.toHaveBeenCalled();
  });
});
