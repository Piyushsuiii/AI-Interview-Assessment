import { ResumeIntelligenceService } from "./resume-intelligence.service";

describe("ResumeIntelligenceService", () => {
  const file = {
    originalname: "resume.pdf",
    mimetype: "application/pdf",
    buffer: Buffer.from("%PDF-test"),
  } as Express.Multer.File;

  afterEach(() => jest.restoreAllMocks());

  it("skips classification when the private service is not configured", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const service = new ResumeIntelligenceService({ get: jest.fn().mockReturnValue("") } as never);
    await expect(service.classify(file)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a validated classification response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      label: "INFORMATION-TECHNOLOGY",
      confidence: 0.91,
      predictions: [{ label: "INFORMATION-TECHNOLOGY", confidence: 0.91 }],
      chunksAnalyzed: 1,
      charactersExtracted: 2_400,
      usedOcr: false,
      model: "distilbert_resume_classifier_candidate",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const config = { get: jest.fn((key: string) => key === "CVERIFY_URL" ? "http://127.0.0.1:8001/" : 30_000) };
    const service = new ResumeIntelligenceService(config as never);

    await expect(service.classify(file)).resolves.toMatchObject({ label: "INFORMATION-TECHNOLOGY", confidence: 0.91 });
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8001/classify", expect.objectContaining({ method: "POST" }));
  });

  it("fails open when the classifier is unavailable", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("connection refused"));
    const config = { get: jest.fn((key: string) => key === "CVERIFY_URL" ? "http://127.0.0.1:8001" : 30_000) };
    const service = new ResumeIntelligenceService(config as never);
    await expect(service.classify(file)).resolves.toBeNull();
  });
});
