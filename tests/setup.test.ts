import { afterEach } from "node:test";
import { prisma } from "../src/config/prisma.js";
import { afterAll, beforeAll, vi } from "vitest";
import { shutdown } from "../src/app.js";

beforeAll(async () => {
  console.error = vi.fn();
  console.log = vi.fn();
  console.warn = vi.fn();
  console.debug = vi.fn();
  console.info = vi.fn();
});

afterEach(async () => {
  await prisma.keyStore.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await shutdown();
  // await prisma.$disconnect();
});
