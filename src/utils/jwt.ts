import { sign, verify } from "jsonwebtoken";
import { Secret } from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import { CustomError } from "../exceptions/CustomError";
import { config } from "../config/config";

const ACCESS_TOKEN_EXPIRATION_TIME = config.JWT_ACCESS_EXPIRATION_TIME;
const REFRESH_TOKEN_EXPIRATION_TIME = config.JWT_REFRESH_EXPIRATION_TIME;
const ACCESS_SECRET = config.JWT_ACCESS_SECRET;
const REFRESH_SECRET = config.JWT_REFRESH_SECRET;

export function generateAccessToken(user: Prisma.UserCreateInput) {
  const jwtAccessSecret: Secret | undefined = ACCESS_SECRET;
  if (!jwtAccessSecret) {
    throw new Error("JWT_REFRESH_SECRET is not defined.");
  }
  return sign(
    { id: user.id, address: user.address, xpub: user.xpub },
    jwtAccessSecret,
    {
      expiresIn: ACCESS_TOKEN_EXPIRATION_TIME,
    }
  );
}

export function generateRefreshToken(user: Prisma.UserCreateInput) {
  const jwtRefreshSecret: Secret | undefined = REFRESH_SECRET;
  if (!jwtRefreshSecret) {
    throw new Error("JWT_REFRESH_SECRET is not defined.");
  }
  return sign(
    { id: user.id, address: user.address, xpub: user.xpub },
    jwtRefreshSecret,
    {
      expiresIn: REFRESH_TOKEN_EXPIRATION_TIME,
    }
  );
}

export function generateTokens(user: Prisma.UserCreateInput) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    accessToken,
    refreshToken,
  };
}

export function verifyRefreshToken(token: string) {
  let tokens;
  const jwtRefreshSecret: Secret | undefined = REFRESH_SECRET;

  if (!jwtRefreshSecret) {
    throw new Error("JWT_REFRESH_SECRET is not defined.");
  }

  jwt.verify(token, jwtRefreshSecret, (err: any, user: any) => {
    if (err) throw new CustomError("Invalid refresh token.", 401);
    tokens = generateTokens(user);
  });

  return tokens;
}
