import { prisma } from "../config/prisma.js";
import { KeyStatus, User } from "../generated/prisma/client.js";
import { ValidationError } from "../lib/errors.js";

export async function createUserToken(
  client: User,
  primaryKey: string,
  secondaryKey: string,
) {
  try {
    return await prisma.keyStore.upsert({
      where: { client: client.id },
      update: {
        primaryKey,
        secondaryKey,
        status: KeyStatus.ACTIVE,
      },
      create: {
        client: client.id,
        primaryKey,
        secondaryKey,
        status: KeyStatus.ACTIVE,
      },
    });
  } catch (error) {
    throw new ValidationError("Failed to create user token");
  }
}
