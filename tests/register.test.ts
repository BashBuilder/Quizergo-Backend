import { it, describe, expect, vi } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import redisClient from "../src/cache/index.js";
import { version } from "../src/routes/index.js";

// Helper to parse OTP that may be in new JSON format
async function getOtpValue(email: string): Promise<string> {
  const otpDataRaw = await redisClient.get(`otp:auth:${email}`);
  if (!otpDataRaw) return "";
  try {
    const parsed = JSON.parse(otpDataRaw);
    return parsed.otp || otpDataRaw;
  } catch {
    return otpDataRaw;
  }
}

describe("Registeration and User email verification ", () => {
  const userPayload = {
    firstName: "Joe",
    lastName: "Doe",
    email: "joe@doe.com",
    password: "123456",
    confirmPassword: "123456",
  };

  it("should verify a user and return proper message", async () => {
    const timestamp = Date.now();
    const email = `joe1-${timestamp}@doe.com`;
    
    const registrationRes = await request(app)
      .post(`/${version}/auth/register`)
      .send({
        ...userPayload,
        email,
      });
    expect(registrationRes.status).toBe(201);
    expect(registrationRes.body.message).toBe(
      "User created successfully. Otp sent to your email, verify to login",
    );
    
    // Get OTP from Redis - wait briefly to ensure it's written
    await new Promise((resolve) => setTimeout(resolve, 100));
    const otp = await getOtpValue(email);
    expect(otp).toBeTruthy();
    
    const verifyRes = await request(app).post(`/${version}/auth/verify`).send({
      email,
      otp,
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.message).toBe("User verified successfully");
  });
});

describe("Login flow", () => {
  const userPayload = {
    firstName: "Joe",
    lastName: "Doe",
    password: "123456",
    confirmPassword: "123456",
  };

  it("should register and verify a user and login", async () => {
    const email = `joe2-${Date.now()}@doe.com`;
    
    const registerRes = await request(app)
      .post(`/${version}/auth/register`)
      .send({ ...userPayload, email });
    expect(registerRes.status).toBe(201);
    
    // Wait briefly to ensure Redis write completes
    await new Promise((resolve) => setTimeout(resolve, 100));
    const otp = await getOtpValue(email);
    expect(otp).toBeTruthy();

    const verifyRes = await request(app).post(`/${version}/auth/verify`).send({
      email,
      otp,
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.message).toBe("User verified successfully");

    const res = await request(app)
      .post(`/${version}/auth/login`)
      .send({ ...userPayload, email });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBeTruthy();
    expect(res.headers["set-cookie"]).toBeTruthy();
    expect(res.body.user.email).toBe(email);
  });
});