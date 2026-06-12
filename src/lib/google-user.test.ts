import { afterEach, describe, expect, it, vi } from "vitest";
import { MongoServerError, ObjectId } from "mongodb";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { findUserByEmail, createGoogleUser } = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  createGoogleUser: vi.fn(),
}));

vi.mock("@/lib/repositories/users", () => ({ findUserByEmail, createGoogleUser }));

import { resolveGoogleUserId } from "./google-user";

afterEach(() => {
  findUserByEmail.mockReset();
  createGoogleUser.mockReset();
});

describe("resolveGoogleUserId", () => {
  it("returns the existing user's id when the email matches", async () => {
    const _id = new ObjectId();
    findUserByEmail.mockResolvedValue({ _id, email: "a@b.co", name: "A" });
    await expect(resolveGoogleUserId("a@b.co", "A")).resolves.toBe(_id.toHexString());
    expect(createGoogleUser).not.toHaveBeenCalled();
  });

  it("creates a user on first sign-in", async () => {
    findUserByEmail.mockResolvedValue(null);
    createGoogleUser.mockResolvedValue("65f1a2b3c4d5e6f7a8b9c0d1");
    await expect(resolveGoogleUserId("a@b.co", "A")).resolves.toBe(
      "65f1a2b3c4d5e6f7a8b9c0d1",
    );
    expect(createGoogleUser).toHaveBeenCalledWith({ email: "a@b.co", name: "A" });
  });

  it("re-reads after losing a duplicate-key race", async () => {
    const _id = new ObjectId();
    findUserByEmail.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id });
    const dup = new MongoServerError({ message: "E11000 duplicate key" });
    dup.code = 11000;
    createGoogleUser.mockRejectedValue(dup);
    await expect(resolveGoogleUserId("a@b.co", "A")).resolves.toBe(_id.toHexString());
  });

  it("throws a diagnosable error when the race re-read finds nothing", async () => {
    findUserByEmail.mockResolvedValue(null);
    const dup = new MongoServerError({ message: "E11000 duplicate key" });
    dup.code = 11000;
    createGoogleUser.mockRejectedValue(dup);
    await expect(resolveGoogleUserId("a@b.co", "A")).rejects.toThrow(
      "duplicate-key insert but re-read found no user",
    );
  });

  it("propagates other DB errors", async () => {
    findUserByEmail.mockResolvedValue(null);
    createGoogleUser.mockRejectedValue(new Error("db down"));
    await expect(resolveGoogleUserId("a@b.co", "A")).rejects.toThrow("db down");
  });
});
