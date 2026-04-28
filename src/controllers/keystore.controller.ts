import { prisma } from "../config/prisma.js";
import { User } from "../generated/prisma/client.js";
import { ValidationError } from "../lib/errors.js";

export async function createUserToken(
  client: User,
  primaryKey: string,
  secondaryKey: string,
) {
  try {
    return await prisma.keyStore.create({
      data: { client: client.id, primaryKey, secondaryKey, status: "active" },
    });
  } catch (error) {
    throw new ValidationError("Failed to create user token");
  }
}
