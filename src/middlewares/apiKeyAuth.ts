import { Request, Response, NextFunction } from "express";
import { CustomError } from "../exceptions/CustomError";
import { config } from "@config/config";

// Define a secure API key for the queue processor service
// In production, this should be a strong random string stored in environment variables
const QUEUE_PROCESSOR_API_KEY = config.QUEUE_PROCESSOR_API_KEY;

/**
 * Middleware to authenticate API requests using an API key
 * This is used for service-to-service communication
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new CustomError("API key missing or invalid", 401);
    }

    const apiKey = authHeader.split(" ")[1];

    // Check if the API key is valid
    // For now we only have one service (queue processor) that needs API key access
    if (apiKey !== QUEUE_PROCESSOR_API_KEY) {
      throw new CustomError("Invalid API key", 401);
    }

    // If the API key is valid, proceed to the next middleware
    next();
  } catch (error) {
    next(error);
  }
};
