import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { postresConnectionString } from "./config.js";

const adapter = new PrismaPg({ connectionString: postresConnectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
