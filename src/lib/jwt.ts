import { tokenInfo } from "../config/config.js";
import { User } from "../generated/prisma/client.js";
import { BadRequestError, InternalServerError } from "./errors.js";
import jwt, { JsonWebTokenError } from "jsonwebtoken";

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
    throw new InternalServerError("Token generation failed");
  }
}

export async function decodeToken(token: string): Promise<JwtPayload> {
  if (!token) throw new InternalServerError("Token not defined");
  try {
    const decode = jwt.decode(token);
    if (!decode || typeof decode === "string")
      throw new JsonWebTokenError("Token decoding failed");
    return decode as JwtPayload;
  } catch (error) {
    throw new JsonWebTokenError("Token decoding failed");
  }
}

export async function validateToken(
  token: string,
  secret: string,
): Promise<JwtPayload> {
  if (!token) throw new JsonWebTokenError("Token not defined");
  try {
    return new Promise((resole, reject) => {
      jwt.verify(token, secret, (err, decoded) => {
        if (err?.name === "TokenExpiredError")
          reject(new JsonWebTokenError("Token expired"));
        if (err) reject(new JsonWebTokenError("Token validation failed"));
        resole(decoded as JwtPayload);
      });
    });
  } catch (error) {
    throw new JsonWebTokenError("Token validation failed");
  }
}

export async function createTokens(
  user: User,
  accessTokenKey: string,
  refreshTokenKey: string,
) {
  try {
    const accessToken = await encodeToken(
      new JwtPayload(
        tokenInfo.issuer,
        tokenInfo.audience,
        user.id,
        accessTokenKey,
        tokenInfo.accessTokenValidity,
      ),
      tokenInfo.secret,
    );
    const refreshToken = await encodeToken(
      new JwtPayload(
        tokenInfo.issuer,
        tokenInfo.audience,
        user.id,
        refreshTokenKey,
        tokenInfo.refreshTokenValidity,
      ),
      tokenInfo.secret,
    );
    if (!accessToken || !refreshToken)
      throw new InternalServerError("Token generation failed");
    return { accessToken, refreshToken };
  } catch (error) {
    throw error;
  }
}

export const getAccessToken = (authorization: string) => {
  if (!authorization)
    throw new BadRequestError("Authorization header not found");
  if (!authorization.startsWith("Bearer"))
    return new BadRequestError("Invalid authorization header");
  return authorization.split(" ")[1];
};

export const validateTokenData = (payload: JwtPayload) => {
  if (payload.aud !== tokenInfo.audience)
    throw new BadRequestError("Audience not found");
  if (payload.iss !== tokenInfo.issuer)
    throw new BadRequestError("Issuer not found");
  if (!payload.sub) throw new BadRequestError("Subject not found");
  if (!payload.exp) throw new BadRequestError("Expiration not found");
  if (!payload.iat) throw new BadRequestError("Issued at not found");
  if (!payload.prm) throw new BadRequestError("Permission not found");

  return true;
};
