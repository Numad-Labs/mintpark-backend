import {
  sign,
  verify,
  Secret,
  JsonWebTokenError,
  TokenExpiredError
} from "jsonwebtoken";
import { config } from "../config/config";
import jwt from "jsonwebtoken";
import { CustomError } from "../exceptions/CustomError";
import { ROLES } from "../types/db/enums";
import { AuthenticatedUser } from "../../custom";

const ACCESS_TOKEN_EXPIRATION_TIME = config.JWT_ACCESS_EXPIRATION_TIME;
const REFRESH_TOKEN_EXPIRATION_TIME = config.JWT_REFRESH_EXPIRATION_TIME;
const jwtAccessSecret: Secret = config.JWT_ACCESS_SECRET;
const jwtRefreshSecret: Secret = config.JWT_REFRESH_SECRET;

type JwtPayload = {
  id: string;
  role: ROLES;
};

export function generateAccessToken(payload: JwtPayload) {
  return sign({ id: payload.id, role: payload.role }, jwtAccessSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRATION_TIME
  });
}

export function verifyRefreshToken(token: string): Promise<any> {
  return new Promise((resolve) => {
    try {
      const payload = jwt.verify(token, jwtRefreshSecret) as AuthenticatedUser;

      const tokens = generateTokens(payload);
      resolve(tokens);
    } catch (error) {
      if (
        error instanceof JsonWebTokenError ||
        error instanceof TokenExpiredError
      ) {
        throw error;
      }
      resolve(false);
    }
  });
}

export function verifyAccessToken(
  token: string,
  jwtAccessSecret: string
): Promise<AuthenticatedUser | false> {
  return new Promise((resolve) => {
    try {
      const payload = jwt.verify(token, jwtAccessSecret);
      resolve(payload as AuthenticatedUser);
    } catch (error) {
      // if (
      //   error instanceof JsonWebTokenError ||
      //   error instanceof TokenExpiredError
      // ) {
      //   throw error;
      // }
      resolve(false);
    }
  });
}

export function generateRefreshToken(payload: JwtPayload) {
  return sign({ id: payload.id, role: payload.role }, jwtRefreshSecret, {
    expiresIn: REFRESH_TOKEN_EXPIRATION_TIME
  });
}

export function generateTokens(payload: JwtPayload) {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    accessToken,
    refreshToken
  };
}
