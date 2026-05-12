import { Request } from "express";
import { ApiKey, KeyStore, User } from "../generated/prisma/client.ts";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      retriesLeft?: number;
      apiKey?: ApiKey;
      accessToken?: string;
      refreshToken?: string;
      keyStore?: KeyStore;
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
