import { prisma } from "../src/config/prisma.js";
import { beforeAll, afterEach, afterAll, vi } from "vitest";
import { connectRedis } from "../src/cache/index.js";
import redisClient from "../src/cache/index.js";

// Mock the Resend email service to avoid actual email sending during tests
vi.mock("../src/lib/resend.ts", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendOTPEmail: vi.fn().mockResolvedValue(undefined),
  forwardContactEmail: vi.fn().mockResolvedValue(undefined),
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({ id: "test-email-id" }),
    },
  },
}));

// Initialize console mocks first
beforeAll(async () => {
  console.error = vi.fn();
  console.log = vi.fn();
  console.warn = vi.fn();
  console.debug = vi.fn();
  console.info = vi.fn();
  
  // Ensure Redis is connected for tests
  await connectRedis();
});

// Clean up after each test
afterEach(async () => {
  // Clear throttle keys
  try {
    if (redisClient.isOpen) {
      const keys = await redisClient.keys("throttle:*");
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }
  } catch {
    /* ignore */
  }
  
  // Clean up KeyStore first (FK constraint), then User
  await prisma.keyStore.deleteMany();
  await prisma.user.deleteMany();
  
  // Clear any leftover OTP keys from Redis
  try {
    if (redisClient.isOpen) {
      const otpKeys = await redisClient.keys("otp:*");
      if (otpKeys.length > 0) {
        await redisClient.del(otpKeys);
      }
    }
  } catch {
    /* ignore */
  }
});