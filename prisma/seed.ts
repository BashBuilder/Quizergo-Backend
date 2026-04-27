// import { PrismaClient, Permissions } from "@prisma/client";
import crypto from "node:crypto";
import { Permissions } from "../src/generated/prisma/enums.js";
import { prisma } from "../src/config/prisma.js";

function generateApiKey() {
  const rawKey = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
  return { rawKey, hash };
}

async function main() {
  console.log("🌱 Seeding database...");
  const { rawKey, hash } = generateApiKey();
  const apiKey = await prisma.apiKey.create({
    data: {
      key: hash,
      permissions: [Permissions.GENERAL],
      status: "active",
    },
  });

  console.log("✅ API Key created:");
  console.log("Raw Key (save this, won't be shown again):", rawKey);
  console.log("DB Record ID:", apiKey.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
