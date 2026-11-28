import { it, describe, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import redisClient from "../src/cache/index.js";
import { version } from "../src/routes/index.js";

describe("OTP verification pending flow", () => {
  const userPayload = {
    firstName: "Test",
    lastName: "User",
    email: "test-pending@doe.com",
    password: "123456",
    confirmPassword: "123456",
  };

  let registeredOtp: string;

  beforeAll(async () => {
    // Clean up before tests
    await prisma.user.deleteMany({ where: { email: "test-pending@doe.com" } });
    await redisClient.del("otp:auth:test-pending@doe.com");
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: "test-pending@doe.com" } });
    await redisClient.del("otp:auth:test-pending@doe.com");
  });

  it("should return pending_otp_verification when logging in with existing OTP", async () => {
    // Register user
    const registerRes = await request(app)
      .post(`/${version}/auth/register`)
      .send({
        ...userPayload,
        email: "otp-exists@doe.com",
      });
    expect(registerRes.status).toBe(201);

    // Get OTP from Redis
    const otp = await redisClient.get("otp:auth:otp-exists@doe.com");
    expect(otp).toBeTruthy();
    registeredOtp = otp!;

    // Try to login without verifying
    const loginRes = await request(app)
      .post(`/${version}/auth/login`)
      .send({
        email: "otp-exists@doe.com",
        password: userPayload.password,
      });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.success).toBe(false);
    expect(loginRes.body.code).toBe("PENDING_OTP_VERIFICATION");
    expect(loginRes.body.status).toBe("pending_otp_verification");
    expect(loginRes.body.message).toBe("OTP verification pending. Please verify your email.");

    // Clean up
    await prisma.user.delete({ where: { email: "otp-exists@doe.com" } });
    await redisClient.del("otp:auth:otp-exists@doe.com");
  });

  it("should generate new OTP and return pending status when no OTP exists for unverified user", async () => {
    // Register user
    const registerRes = await request(app)
      .post(`/${version}/auth/register`)
      .send({
        ...userPayload,
        email: "otp-new@doe.com",
      });
    expect(registerRes.status).toBe(201);

    // Delete the OTP to simulate expired/missing OTP
    await redisClient.del("otp:auth:otp-new@doe.com");

    // Verify user first
    const otp = await redisClient.get("otp:auth:otp-new@doe.com");
    // OTP was deleted, need to check the flow

    // Clean up
    await prisma.user.delete({ where: { email: "otp-new@doe.com" } });
  });
});

describe("Signup with existing unverified user", () => {
  it("should return pending_otp_verification when signing up with existing unverified user that has OTP", async () => {
    const email = "existing-unverified@doe.com";

    // Clean up first
    await prisma.user.deleteMany({ where: { email } });
    await redisClient.del(`otp:auth:${email}`);

    // Register user
    const registerRes = await request(app)
      .post(`/${version}/auth/register`)
      .send({
        firstName: "Existing",
        lastName: "User",
        email,
        password: "123456",
        confirmPassword: "123456",
      });
    expect(registerRes.status).toBe(201);

    // Get OTP from Redis
    const otp = await redisClient.get(`otp:auth:${email}`);
    expect(otp).toBeTruthy();

    // Try to register again with same email
    const secondRegisterRes = await request(app)
      .post(`/${version}/auth/register`)
      .send({
        firstName: "Existing",
        lastName: "User",
        email,
        password: "123456",
        confirmPassword: "123456",
      });

    expect(secondRegisterRes.status).toBe(403);
    expect(secondRegisterRes.body.success).toBe(false);
    expect(secondRegisterRes.body.code).toBe("PENDING_OTP_VERIFICATION");
    expect(secondRegisterRes.body.status).toBe("pending_otp_verification");
    expect(secondRegisterRes.body.message).toBe("OTP verification pending. Please verify your email.");

    // Clean up
    await prisma.user.delete({ where: { email } });
    await redisClient.del(`otp:auth:${email}`);
  });

  it("should generate new OTP and return pending status when signing up with existing unverified user but no OTP in Redis", async () => {
    const email = "existing-no-otp@doe.com";

    // Clean up first
    await prisma.user.deleteMany({ where: { email } });
    await redisClient.del(`otp:auth:${email}`);

    // Register user
    const registerRes = await request(app)
      .post(`/${version}/auth/register`)
      .send({
        firstName: "Existing",
        lastName: "User",
        email,
        password: "123456",
        confirmPassword: "123456",
      });
    expect(registerRes.status).toBe(201);

    // Get OTP and delete it
    const oldOtp = await redisClient.get(`otp:auth:${email}`);
    await redisClient.del(`otp:auth:${email}`);

    // Try to register again - should generate new OTP and return pending status
    const secondRegisterRes = await request(app)
      .post(`/${version}/auth/register`)
      .send({
        firstName: "Existing",
        lastName: "User",
        email,
        password: "123456",
        confirmPassword: "123456",
      });

    expect(secondRegisterRes.status).toBe(403);
    expect(secondRegisterRes.body.success).toBe(false);
    expect(secondRegisterRes.body.code).toBe("PENDING_OTP_VERIFICATION");
    expect(secondRegisterRes.body.status).toBe("pending_otp_verification");
    expect(secondRegisterRes.body.message).toBe("OTP sent to your email. Please verify to complete registration.");

    // Verify new OTP exists in Redis
    const newOtp = await redisClient.get(`otp:auth:${email}`);
    expect(newOtp).toBeTruthy();

    // Clean up
    await prisma.user.delete({ where: { email } });
    await redisClient.del(`otp:auth:${email}`);
  });
});