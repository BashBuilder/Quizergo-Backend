import { Request } from "express";
import { ApiKey } from "../generated/prisma/client.ts";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      retriesLeft?: number;
      apiKey?: ApiKey;
    }
  }
  interface TokenPayload {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  }
}

export {};
