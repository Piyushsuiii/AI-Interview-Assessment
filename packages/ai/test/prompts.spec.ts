import {
  candidateComparisonOutputSchema,
  getPrompt,
  integritySimilarityOutputSchema,
  promptRegistry,
  type PromptName,
} from "../index";

const addedPromptNames: PromptName[] = [
  "interviewer.followup",
  "interviewer.evaluation",
  "candidate.summary",
  "candidate.comparison",
  "integrity.similarity",
];

describe("prompt registry", () => {
  it.each(addedPromptNames)("looks up the versioned %s prompt", (name) => {
    const prompt = getPrompt(name);

    expect(prompt).toBe(promptRegistry[name]);
    expect(prompt.name).toBe(name);
    expect(prompt.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(prompt.system).toContain("Return exactly one valid JSON object");
    expect(prompt.system).toContain("Do not invent candidates, evidence");
    expect(prompt.system).toContain("decision support");
    expect(prompt.system).toContain("Do not infer protected or sensitive traits");
  });

  it("renders typed comparison variables and preserves supplied IDs", () => {
    const rendered = getPrompt("candidate.comparison").render({
      roleId: "role-1",
      criteria: [{ id: "criterion-1", name: "Communication" }],
      candidates: [
        {
          candidateId: "candidate-1",
          evidence: [{ id: "evidence-1", text: "Explained a tradeoff" }],
        },
      ],
    });

    expect(rendered).toContain('"roleId": "role-1"');
    expect(rendered).toContain('"candidateId": "candidate-1"');
    expect(rendered).toContain('"id": "evidence-1"');
  });

  it("renders similarity inputs without altering response text", () => {
    const text = "Exact response text with { braces }";
    const rendered = getPrompt("integrity.similarity").render({
      assessmentId: "assessment-1",
      responses: [{ responseId: "response-1", text }],
    });

    expect(JSON.parse(rendered.split("\n").slice(1).join("\n"))).toEqual({
      assessmentId: "assessment-1",
      responses: [{ responseId: "response-1", text }],
    });
  });
});

describe("representative prompt output schemas", () => {
  it("accepts ID-cited comparison output", () => {
    expect(
      candidateComparisonOutputSchema.safeParse({
        roleId: "role-1",
        comparisons: [
          {
            candidateId: "candidate-1",
            criterionAssessments: [
              {
                criterionId: "criterion-1",
                assessment: "Supported",
                evidenceIds: ["evidence-1"],
              },
            ],
            limitations: [],
          },
        ],
        decisionSupport: "Human review is required.",
        limitations: [],
      }).success,
    ).toBe(true);
  });

  it("rejects out-of-range similarity scores", () => {
    expect(
      integritySimilarityOutputSchema.safeParse({
        assessmentId: "assessment-1",
        matches: [
          {
            responseIds: ["response-1", "response-2"],
            similarityScore: 1.1,
            explanation: "Similar wording",
            sharedText: ["same phrase"],
          },
        ],
        decisionSupport: "Review manually.",
        limitations: [],
      }).success,
    ).toBe(false);
  });
});
