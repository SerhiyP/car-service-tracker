import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendVerificationEmail } from "./email";

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    vi.stubEnv("BREVO_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "noreply@example.com");
    vi.stubEnv("EMAIL_FROM_NAME", "Car Service Tracker");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts a localized email to Brevo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendVerificationEmail("user@example.com", "123456", "en");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("test-key");
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual([{ email: "user@example.com" }]);
    expect(body.sender).toEqual({ email: "noreply@example.com", name: "Car Service Tracker" });
    expect(body.subject).toBe("Your Car Service Tracker verification code");
    expect(body.textContent).toContain("123456");
  });

  it("localizes the body for uk", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendVerificationEmail("user@example.com", "654321", "uk");

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.subject).toBe("Ваш код підтвердження Car Service Tracker");
    expect(body.textContent).toContain("654321");
  });

  it("throws when Brevo responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
    await expect(sendVerificationEmail("user@example.com", "123456", "en")).rejects.toThrow(/401/);
  });

  it("throws when configuration is missing", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    await expect(sendVerificationEmail("user@example.com", "123456", "en")).rejects.toThrow(
      /BREVO_API_KEY/,
    );
  });
});
