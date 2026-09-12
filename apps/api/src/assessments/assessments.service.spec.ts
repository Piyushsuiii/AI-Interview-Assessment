import { ConflictException, NotFoundException } from "@nestjs/common";
import { AssessmentsService } from "./assessments.service";

describe("AssessmentsService", () => {
  it("rejects writes to an assessment from another tenant", async () => {
    const tx = {
      assessment: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
      job: { findFirst: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new AssessmentsService(prisma as never);

    await expect(service.update("org-a", "assessment-from-org-b", { title: "Changed" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.assessment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "assessment-from-org-b", organizationId: "org-a" } }),
    );
    expect(tx.assessment.update).not.toHaveBeenCalled();
  });

  it("does not create a new question version for a published assessment", async () => {
    const tx = {
      assessment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "assessment-1",
          status: "PUBLISHED",
          versions: [{ id: "version-1" }],
        }),
      },
      assessmentQuestion: { findFirst: jest.fn(), update: jest.fn() },
      questionVersion: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new AssessmentsService(prisma as never);

    await expect(
      service.updateQuestion("org-1", "assessment-1", "question-link-1", { prompt: "Changed" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.questionVersion.create).not.toHaveBeenCalled();
    expect(tx.assessmentQuestion.update).not.toHaveBeenCalled();
  });

  it("creates a replacement question version instead of editing content in place", async () => {
    const tx = {
      assessment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "assessment-1",
          status: "DRAFT",
          versions: [{ id: "assessment-version-1" }],
        }),
      },
      assessmentQuestion: {
        findFirst: jest.fn().mockResolvedValue({
          id: "link-1",
          order: 0,
          weight: 1,
          required: true,
          questionVersionId: "question-version-1",
          questionVersion: {
            id: "question-version-1",
            questionId: "question-1",
            version: 1,
            question: { type: "TECHNICAL" },
            prompt: "Old",
            difficulty: "MEDIUM",
            expectedAnswer: null,
            rubric: null,
            skills: [],
            maxScore: 10,
          },
        }),
        update: jest.fn().mockResolvedValue({ id: "link-1" }),
      },
      question: { update: jest.fn().mockResolvedValue({}) },
      questionVersion: { create: jest.fn().mockResolvedValue({ id: "question-version-2" }) },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new AssessmentsService(prisma as never);

    await service.updateQuestion("org-1", "assessment-1", "link-1", { prompt: "New" });

    expect(tx.questionVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ questionId: "question-1", version: 2, prompt: "New" }),
    });
    expect(tx.assessmentQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { questionVersionId: "question-version-2" } }),
    );
  });
});
