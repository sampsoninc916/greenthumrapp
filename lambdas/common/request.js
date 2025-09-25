import crypto from "node:crypto";
import { badRequest } from "./http.js";

export const parseJson = (event) => {
  if (!event.body) {
    return {};
  }

  try {
    return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch (error) {
    throw badRequest("Invalid JSON payload", { error: error.message });
  }
};

export const getRequestId = (event) =>
  event.headers?.["x-request-id"] || event.headers?.["X-Request-Id"] || crypto.randomUUID();

export const getQueryParam = (event, key) =>
  event.queryStringParameters?.[key] ?? event.multiValueQueryStringParameters?.[key]?.[0];

export const getPathParam = (event, key) =>
  event.pathParameters?.[key];
