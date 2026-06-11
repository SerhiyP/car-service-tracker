import { describe, expect, it } from "vitest";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  cooldownSecondsLeft,
  generateCode,
  hashCode,
  isExpired,
} from "./verification";

describe("generateCode", () => {
  it("always returns exactly 6 digits", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });

  it("zero-pads small values to 6 digits", () => {
    expect((0).toString().padStart(6, "0")).toBe("000000");
    expect((42).toString().padStart(6, "0")).toBe("000042");
  });
});

describe("hashCode", () => {
  it("is deterministic", () => {
    expect(hashCode("123456")).toBe(hashCode("123456"));
  });

  it("differs for different codes", () => {
    expect(hashCode("123456")).not.toBe(hashCode("123457"));
  });

  it("does not contain the code itself", () => {
    expect(hashCode("123456")).not.toContain("123456");
  });

  it("is a 64-char hex string", () => {
    expect(hashCode("123456")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isExpired", () => {
  const expiresAt = new Date("2026-06-11T12:00:00Z");

  it("is not expired before the deadline", () => {
    expect(isExpired(expiresAt, new Date("2026-06-11T11:59:59Z"))).toBe(false);
  });

  it("is expired exactly at the deadline", () => {
    expect(isExpired(expiresAt, expiresAt)).toBe(true);
  });

  it("is expired well after the deadline", () => {
    expect(isExpired(expiresAt, new Date("2026-06-11T13:00:00Z"))).toBe(true);
  });
});

describe("cooldownSecondsLeft", () => {
  const lastSentAt = new Date("2026-06-11T12:00:00Z");

  it("is the full cooldown immediately after sending", () => {
    expect(cooldownSecondsLeft(lastSentAt, lastSentAt)).toBe(RESEND_COOLDOWN_MS / 1000);
  });

  it("rounds partial seconds up", () => {
    expect(cooldownSecondsLeft(lastSentAt, new Date("2026-06-11T12:00:59.500Z"))).toBe(1);
  });

  it("is 0 once the cooldown has passed", () => {
    expect(cooldownSecondsLeft(lastSentAt, new Date("2026-06-11T12:01:00Z"))).toBe(0);
  });
});

describe("constants", () => {
  it("codes live 15 minutes, 5 attempts, 60s cooldown", () => {
    expect(CODE_TTL_MS).toBe(15 * 60 * 1000);
    expect(MAX_ATTEMPTS).toBe(5);
    expect(RESEND_COOLDOWN_MS).toBe(60 * 1000);
  });
});
