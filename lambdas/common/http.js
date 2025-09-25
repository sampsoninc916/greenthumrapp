const defaultHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN ?? "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Request-Id",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PATCH,PUT,DELETE",
};

export const json = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { ...defaultHeaders, ...headers },
  body: JSON.stringify(body ?? {}),
});

export const ok = (payload, headers = {}) => json(200, payload, headers);
export const created = (payload, headers = {}) => json(201, payload, headers);
export const noContent = (headers = {}) => ({
  statusCode: 204,
  headers: { ...defaultHeaders, ...headers },
  body: "",
});

export const badRequest = (message, details) =>
  json(400, { message, details });

export const unauthorized = (message = "Unauthorized") =>
  json(401, { message });

export const forbidden = (message = "Forbidden") =>
  json(403, { message });

export const notFound = (message = "Not Found") => json(404, { message });

export const serverError = (message = "Internal Server Error", details) =>
  json(500, { message, details });
