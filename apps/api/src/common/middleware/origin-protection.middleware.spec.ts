import { originProtection } from "./origin-protection.middleware";

describe("originProtection", () => {
  function invoke(method: string, headers: Record<string, string> = {}) {
    const request = { method, get: (name: string) => headers[name.toLowerCase()] } as never;
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as never;
    const next = jest.fn();
    originProtection("https://app.example.com")(request, response, next);
    return { response: response as unknown as { status: jest.Mock; json: jest.Mock }, next };
  }

  it("allows state-changing requests from the configured frontend", () => {
    expect(invoke("POST", { origin: "https://app.example.com" }).next).toHaveBeenCalledTimes(1);
  });

  it("rejects a cross-origin state-changing request", () => {
    const { response, next } = invoke("DELETE", { origin: "https://attacker.example" });
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it("allows server-to-server requests without browser origin metadata", () => {
    expect(invoke("POST").next).toHaveBeenCalledTimes(1);
  });
});
