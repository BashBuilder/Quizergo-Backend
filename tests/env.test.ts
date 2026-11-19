import { afterEach, describe, expect, it } from "vitest";
import { handleEnv } from "../src/utils/env.util.js";
import { ConfigurationError } from "../src/lib/errors.js";

const watchedKeys = [
  "NODE_ENV",
  "PORT",
  "LOG_DIRECTORY",
  "ACCESS_TOKEN_VALIDITY_SEC",
  "REFRESH_TOKEN_VALIDITY_SEC",
  "JWT_ISSUER",
  "JWT_AUDIENCE",
  "JWT_SECRET",
  "JWT_ALGORITHM",
  "ALOC_API_KEY",
  "ALOC_BASE_URL",
  "DB_URL",
  "REDIS_URL",
  "RESEND_API_KEY",
  "RESEND_CONTACT_EMAIL",
] as const;

const originalEnv = new Map<string, string | undefined>(
  watchedKeys.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("handleEnv", () => {
  it("resolves when every required variable is provided", async () => {
    await expect(handleEnv()).resolves.toBeUndefined();
  });

  it("throws a ConfigurationError naming a missing variable", async () => {
    delete process.env.JWT_SECRET;

    await expect(handleEnv()).rejects.toBeInstanceOf(ConfigurationError);
    await expect(handleEnv()).rejects.toThrow(/JWT_SECRET is required/);
  });

  it("throws when a variable is present but empty", async () => {
    process.env.RESEND_CONTACT_EMAIL = "";

    await expect(handleEnv()).rejects.toThrow(
      /RESEND_CONTACT_EMAIL must be a valid email address/,
    );
  });

  it("does not leak env values in the error message", async () => {
    const secret = process.env.JWT_SECRET;
    process.env.PORT = "not-a-number";

    try {
      await handleEnv();
      throw new Error("handleEnv should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as Error).message).toContain("PORT");
      if (secret) expect((error as Error).message).not.toContain(secret);
    }
  });
});
