import { serverError } from "./http.js";
import { createLogger } from "./logger.js";

export const handleError = (error, context = {}) => {
  const logger = createLogger({ scope: "error-handler", ...context });

  if (error?.statusCode && error?.body) {
    return error;
  }

  if (error?.statusCode) {
    logger.warn("Returning custom error", error);
    return {
      statusCode: error.statusCode,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN ?? "*",
      },
      body: JSON.stringify({ message: error.message, details: error.details }),
    };
  }

  logger.error("Unhandled error", error);
  return serverError(undefined, { error: error?.message });
};
