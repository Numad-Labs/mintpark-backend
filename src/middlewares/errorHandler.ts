import { NextFunction, Response } from "express";
import { CustomError } from "../exceptions/CustomError";
import { ZodError } from "zod";
import { MulterError } from "multer";
import logger from "../config/winston";
import { AuthenticatedRequest } from "../../custom";
import { config } from "../config/config";
import { DatabaseError } from "pg";

interface ErrorResponse {
  success: false;
  data: null;
  error: string;
  stack?: string;
}

export function errorHandler(
  err: Error | CustomError | ZodError | MulterError,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const statusCode = getStatusCode(err, res);
  const message = getErrorMessage(err);
  const userId = req.user?.id;

  logError(statusCode, message, userId, err.stack);

  const errorResponse: ErrorResponse = {
    success: false,
    data: null,
    error: message,
  };

  if (config.NODE_ENV !== "production") {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

function getStatusCode(
  err: Error | CustomError | ZodError | MulterError,
  res: Response
): number {
  if (err instanceof CustomError) return err.errorCode;
  if (err instanceof ZodError || err instanceof MulterError) return 400;
  return res.statusCode !== 200 ? res.statusCode : 500;
}

function getErrorMessage(
  err: Error | CustomError | ZodError | MulterError
): string {
  if (err instanceof ZodError) {
    return `${err.issues[0].message}`;
  }
  return err.message;
}

function logError(
  statusCode: number,
  message: string,
  userId?: string,
  stack?: string
): void {
  if (statusCode < 500) stack = undefined;
  const logData = { message, userId, stack };

  if (statusCode >= 500) {
    logger.error(logData);
  } else if (statusCode === 429 || statusCode === 404 || statusCode === 409) {
    logger.warn(logData);
  } else if (statusCode >= 400) {
    logger.info(logData);
  }
}
