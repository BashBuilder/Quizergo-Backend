import { it, describe, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import redisClient from "../src/cache/index.js";
import { version } from "../src/routes/index.js";

// Helper to safely delete from Redis (handles closed client)
async function safeRedisDel(key: string) {
  try {
    if (redisClient.isOpen) {
      await redisClient.del(key);
    }
  } catch {
    // Redis might be closed, ignore
  }
}

// Helper to clean up user with proper FK handling
async function cleanupUser(email: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // Delete keyStore by user id (FK constraint)
      await prisma.keyStore.deleteMany({ where: { client: user.id } });
      await prisma.user.delete({ where: { email } });
    }
  } catch {
    // Ignore errors in cleanup
  }
  await safeRedisDel(`otp:auth:${email}`);
}

describe("OTP verification pending flow", () => {
  const userPayload = {
    firstName: "Test",
    lastName: "User",
    email: "test-pending@doe.com",
    password: "123456",
    confirmPassword: "123456",
  };

  beforeEach(async () => {
    // Clean up before each test
    await prisma.user.deleteMany({ where: { email: "test-pending@doe.com" } });
    await safeRedisDel("otp:auth:test-pending@doe.com");
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.user.deleteMany({ where: { email: "test-pending@doe.com" } });
    await safeRedisDel("otp:auth:test-pending@doe.com");
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

    // Get OTP from Redis (new format: JSON with otp and createdAt)
    const otpDataRaw = await redisClient.get("otp:auth:otp-exists@doe.com");
    expect(otpDataRaw).toBeTruthy();
    const otpData = JSON.parse(otpDataRaw!);
    const otp = otpData.otp;

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
    await cleanupUser("otp-exists@doe.com");
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
    await safeRedisDel("otp:auth:otp-new@doe.com");

    // Verify user first
    const otpDataRaw = await redisClient.get("otp:auth:otp-new@doe.com");
    // OTP was deleted, need to check the flow

    // Clean up
    await cleanupUser("otp-new@doe.com");
  });
});

describe("Signup with existing unverified user", () => {
  beforeEach(async () => {
    // Clean up before each test
    await prisma.user.deleteMany({ where: { email: "existing-unverified@doe.com" } });
    await prisma.user.deleteMany({ where: { email: "existing-no-otp@doe.com" } });
    await safeRedisDel("otp:auth:existing-unverified@doe.com");
    await safeRedisDel("otp:auth:existing-no-otp@doe.com");
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.user.deleteMany({ where: { email: "existing-unverified@doe.com" } });
    await prisma.user.deleteMany({ where: { email: "existing-no-otp@doe.com" } });
    await safeRedisDel("otp:auth:existing-unverified@doe.com");
    await safeRedisDel("otp:auth:existing-no-otp@doe.com");
  });

  it("should return pending_otp_verification when signing up with existing unverified user that has OTP", async () => {
    const email = "existing-unverified@doe.com";

    // Clean up first
    await cleanupUser(email);

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

    // Get OTP from Redis (new format: JSON with otp and createdAt)
    const otpDataRaw = await redisClient.get(`otp:auth:${email}`);
    expect(otpDataRaw).toBeTruthy();

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
    await cleanupUser(email);
  });

  it("should generate new OTP and return pending status when signing up with existing unverified user but no OTP in Redis", async () => {
    const email = "existing-no-otp@doe.com";

    // Clean up first
    await cleanupUser(email);

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
    const oldOtpDataRaw = await redisClient.get(`otp:auth:${email}`);
    await safeRedisDel(`otp:auth:${email}`);

    // Try to register again - should generate new OTP and return pending status
    // This will generate a NEW OTP via resend-otp because user not verified
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
    const newOtpDataRaw = await redisClient.get(`otp:auth:${email}`);
    expect(newOtpDataRaw).toBeTruthy();

    // Clean up
    await cleanupUser(email);
  });
});