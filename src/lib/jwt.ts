import { tokenInfo } from "../config/config.js";
import { User } from "../generated/prisma/client.js";
import { InternalServerError, UnauthorizedError } from "./errors.js";
import jwt from "jsonwebtoken";

export class JwtPayload {
  aud: string;
  sub: string;
  iss: string;
  exp: number;
  iat: number;
  prm: string;

  constructor(
    issuer: string,
    audience: string,
    subject: string,
    permission: string,
    validity: number,
  ) {
    this.aud = audience;
    this.sub = subject;
    this.iss = issuer;
    this.iat = Math.floor(Date.now() / 1000);
    this.exp = this.iat + validity;
    this.prm = permission;
  }
}

export async function encodeToken(
  payload: JwtPayload,
  secret: string,
): Promise<string> {
  if (!secret) throw new InternalServerError("Token secret not defined");
  try {
    return new Promise((resolve, reject) => {
      jwt.sign(payload, secret, (err, token) => {
        if (err) reject(new InternalServerError("Token generation failed"));
        resolve(token as string);
      });
    });
  } catch (error) {
    throw error;
  }
}

export async function decodeToken(token: string): Promise<JwtPayload> {
  if (!token) throw new InternalServerError("Token not defined");
  try {
    const decode = jwt.decode(token);
    if (!decode || typeof decode === "string")
      throw new UnauthorizedError("Token decoding failed");
    return decode as JwtPayload;
  } catch (error) {
    throw error;
  }
}

export async function validateToken(
  token: string,
  secret: string,
): Promise<JwtPayload> {
  if (!token) throw new UnauthorizedError("Token not defined");
  try {
    return new Promise((resole, reject) => {
      jwt.verify(token, secret, (err, decoded) => {
        if (err?.name === "TokenExpiredError")
          reject(new UnauthorizedError("Token expired"));
        if (err) reject(new UnauthorizedError("Token validation failed"));
        resole(decoded as JwtPayload);
      });
    });
  } catch (error) {
    throw error;
  }
}

export async function createTokens(
  user: User,
  accessTokenKey: string,
  refreshTokenKey: string,
) {
  try {
    const accessTokenBody = new JwtPayload(
      tokenInfo.issuer,
      tokenInfo.audience,
      user.id,
      accessTokenKey,
      tokenInfo.accessTokenValidity,
    );
    const refreshTokenBody = new JwtPayload(
      tokenInfo.issuer,
      tokenInfo.audience,
      user.id,
      refreshTokenKey,
      tokenInfo.refreshTokenValidity,
    );
    const accessToken = await encodeToken(
      { ...accessTokenBody },
      tokenInfo.secret,
    );
    const refreshToken = await encodeToken(
      { ...refreshTokenBody },
      tokenInfo.secret,
    );
    if (!accessToken || !refreshToken)
      throw new InternalServerError("Token generation failed");
    return { accessToken, refreshToken };
  } catch (error) {
    throw error;
  }
}

export const getAccessToken = (authorization: string | undefined) => {
  if (!authorization) throw new UnauthorizedError("Request not authorized");
  return authorization;
};

export const validateTokenData = (payload: JwtPayload) => {
  if (payload.aud !== tokenInfo.audience)
    throw new UnauthorizedError("Audience not found");
  if (payload.iss !== tokenInfo.issuer)
    throw new UnauthorizedError("Issuer not found");
  if (!payload.sub) throw new UnauthorizedError("Subject not found");
  if (!payload.exp) throw new UnauthorizedError("Expiration not found");
  if (!payload.iat) throw new UnauthorizedError("Issued at not found");
  if (!payload.prm) throw new UnauthorizedError("Permission not found");
  return true;
};
