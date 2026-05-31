import "dotenv/config";
import { defineConfig } from "prisma/config";
import { postresConnectionString } from "./src/config/prisma.js";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: postresConnectionString,
  },
});
