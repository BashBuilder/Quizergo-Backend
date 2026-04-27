import { prisma } from "../config/prisma.js";
import { ApiKey } from "../generated/prisma/client.js";

export async function findByKey(key: string): Promise<ApiKey | null> {
  return prisma.apiKey.findUnique({ where: { key } });
}
