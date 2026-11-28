import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { version } from "../src/routes/index.js";

// Helper to parse OTP that may be in new JSON format
async function getOtpValue(email: string): Promise<string> {
  const redisClient = await import("../src/cache/index.js");
  const otpDataRaw = await redisClient.default.get(`otp:auth:${email}`);
  if (!otpDataRaw) return "";
  try {
    const parsed = JSON.parse(otpDataRaw);
    return parsed.otp || otpDataRaw;
  } catch {
    return otpDataRaw;
  }
}

describe("OTP resend functionality", () => {
  const userPayload = {
    firstName: "Resend",
    lastName: "Test",
    password: "123456",
    confirmPassword: "123456",
  };

  afterEach(async () => {
    // Clean up - setup.test.ts handles KeyStore cleanup via deleteMany
    await prisma.user.deleteMany({});
  });

  it("should prevent resending OTP within 60 seconds", async () => {
    const email = `resend-cooldown-${Date.now()}@doe.com`;
    
    // Register user
    const registerRes = await request(app)
      .post(`/${version}/auth/register`)
      .send({ ...userPayload, email });
    expect(registerRes.status).toBe(201);
    
    // Wait briefly then try to resend immediately - should fail due to cooldown
    await new Promise((resolve) => setTimeout(resolve, 100));
    const resendRes = await request(app)
      .post(`/${version}/auth/resend-otp`)
      .send({ email });
    expect(resendRes.status).toBe(429); // Too Many Requests
    expect(resendRes.body.code).toBe("TOO_MANY_REQUESTS");
  });

  it("should return error when user does not exist", async () => {
    const email = `nonexistent-${Date.now()}@doe.com`;
    
    const resendRes = await request(app)
      .post(`/${version}/auth/resend-otp`)
      .send({ email });
    expect(resendRes.status).toBe(400);
    expect(resendRes.body.message).toBe("User does not exist");
  });

  it("should generate new OTP after 60 seconds cooldown", async () => {
    const email = `resend-after-cooldown-${Date.now()}@doe.com`;
    
    // Register user
    const registerRes = await request(app)
      .post(`/${version}/auth/register`)
      .send({ ...userPayload, email });
    expect(registerRes.status).toBe(201);
    
    // Get the original OTP
    await new Promise((resolve) => setTimeout(resolve, 100));
    const originalOtp = await getOtpValue(email);
    expect(originalOtp).toBeTruthy();
    
    // Get the stored data and manually set timestamp to 61 seconds ago
    const redisClient = await import("../src/cache/index.js");
    const key = `otp:auth:${email}`;
    const storedData = await redisClient.default.get(key);
    
    if (storedData) {
      const parsed = JSON.parse(storedData);
      // Set timestamp to 61 seconds ago
      const pastTimestamp = Date.now() - 61 * 1000;
      await redisClient.default.set(key, JSON.stringify({ ...parsed, createdAt: pastTimestamp }), {
        EX: 7200,
      });
    }
    
    // Now resend should work
    const resendRes = await request(app)
      .post(`/${version}/auth/resend-otp`)
      .send({ email });
    expect(resendRes.status).toBe(200);
    expect(resendRes.body.message).toBe("OTP sent to your email");
  });
});