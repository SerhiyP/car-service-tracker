import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashCode } from "@/lib/verification";

const repo = vi.hoisted(() => ({
  findCodeByUserId: vi.fn(),
  incrementAttempts: vi.fn(),
  deleteCodeForUser: vi.fn(),
  upsertCodeIfCooldownPassed: vi.fn(),
}));

const email = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/repositories/verification-codes", () => repo);
vi.mock("@/lib/email", () => email);
vi.mock("next-intl/server", () => ({ getLocale: () => Promise.resolve("en") }));

import { consumeCode, issueCode } from "./verification-flow";

const userId = new ObjectId();
const future = new Date(Date.now() + 60_000);
const codeDoc = (over: Record<string, unknown> = {}) => ({
  _id: new ObjectId(),
  userId,
  codeHash: hashCode("123456"),
  expiresAt: future,
  attempts: 0,
  lastSentAt: new Date(),
  purpose: "reset",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  repo.deleteCodeForUser.mockResolvedValue(undefined);
  repo.upsertCodeIfCooldownPassed.mockResolvedValue(true);
});

describe("consumeCode", () => {
  it("consumes a matching code and deletes it", async () => {
    repo.findCodeByUserId.mockResolvedValue(codeDoc());
    const result = await consumeCode(userId, "123456", "reset");
    expect(result).toEqual({ status: "ok" });
    expect(repo.deleteCodeForUser).toHaveBeenCalledWith(userId);
  });

  it("treats a code of a different purpose as no active code", async () => {
    repo.findCodeByUserId.mockResolvedValue(codeDoc({ purpose: "verify" }));
    expect(await consumeCode(userId, "123456", "reset")).toEqual({ status: "noActiveCode" });
    expect(repo.deleteCodeForUser).not.toHaveBeenCalled();
  });

  it("defaults legacy docs without purpose to verify", async () => {
    repo.findCodeByUserId.mockResolvedValue(codeDoc({ purpose: undefined }));
    expect(await consumeCode(userId, "123456", "verify")).toEqual({ status: "ok" });
  });

  it("expires old codes and deletes them", async () => {
    repo.findCodeByUserId.mockResolvedValue(codeDoc({ expiresAt: new Date(Date.now() - 1) }));
    expect(await consumeCode(userId, "123456", "reset")).toEqual({ status: "codeExpired" });
    expect(repo.deleteCodeForUser).toHaveBeenCalled();
  });

  it("counts wrong attempts and reports attempts left", async () => {
    repo.findCodeByUserId.mockResolvedValue(codeDoc());
    repo.incrementAttempts.mockResolvedValue(2);
    expect(await consumeCode(userId, "000000", "reset")).toEqual({
      status: "codeInvalid",
      attemptsLeft: 3,
    });
    expect(repo.deleteCodeForUser).not.toHaveBeenCalled();
  });

  it("locks and deletes after the attempt cap", async () => {
    repo.findCodeByUserId.mockResolvedValue(codeDoc());
    repo.incrementAttempts.mockResolvedValue(5);
    expect(await consumeCode(userId, "000000", "reset")).toEqual({ status: "tooManyAttempts" });
    expect(repo.deleteCodeForUser).toHaveBeenCalled();
  });

  it("reports no active code when none exists", async () => {
    repo.findCodeByUserId.mockResolvedValue(null);
    expect(await consumeCode(userId, "123456", "reset")).toEqual({ status: "noActiveCode" });
  });
});

describe("issueCode", () => {
  it("stores a reset-purpose code and sends the reset email", async () => {
    const sent = await issueCode(userId, "user@example.com", "reset");
    expect(sent).toBe(true);
    const fields = repo.upsertCodeIfCooldownPassed.mock.calls[0][1];
    expect(fields.purpose).toBe("reset");
    expect(email.sendPasswordResetEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringMatching(/^\d{6}$/),
      "en",
    );
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends the verification email for verify purpose", async () => {
    await issueCode(userId, "user@example.com", "verify");
    expect(email.sendVerificationEmail).toHaveBeenCalled();
  });

  it("returns false without sending when the cooldown blocks", async () => {
    repo.upsertCodeIfCooldownPassed.mockResolvedValue(false);
    expect(await issueCode(userId, "user@example.com", "reset")).toBe(false);
    expect(email.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
