import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { requireRole } from "../common/auth.js";
import { ROLES } from "../common/roles.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { parseJson, getQueryParam, getRequestId } from "../common/request.js";
import { ok, badRequest } from "../common/http.js";

const handleList = async (event, logger) => {
  const client = getDocumentClient();
  const status = getQueryParam(event, "status");

  const params = {
    TableName: process.env.USERS_TABLE,
    ProjectionExpression: "userId, email, role, displayName, status, createdAt, updatedAt",
  };

  if (status) {
    params.FilterExpression = "#status = :status";
    params.ExpressionAttributeNames = { "#status": "status" };
    params.ExpressionAttributeValues = { ":status": status };
  }

  const response = await client.send(new ScanCommand(params));

  return ok({ items: response.Items ?? [] });
};

const handlePost = async (event, logger) => {
  const body = parseJson(event);

  if (!body.userId || !body.action) {
    return badRequest("userId and action are required");
  }

  const client = getDocumentClient();
  const now = new Date().toISOString();

  switch (body.action) {
    case "suspend": {
      await client.send(
        new UpdateCommand({
          TableName: process.env.USERS_TABLE,
          Key: { userId: body.userId },
          UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt",
          ExpressionAttributeNames: { "#status": "status", "#updatedAt": "updatedAt" },
          ExpressionAttributeValues: { ":status": "suspended", ":updatedAt": now },
        })
      );
      break;
    }
    case "activate": {
      await client.send(
        new UpdateCommand({
          TableName: process.env.USERS_TABLE,
          Key: { userId: body.userId },
          UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt",
          ExpressionAttributeNames: { "#status": "status", "#updatedAt": "updatedAt" },
          ExpressionAttributeValues: { ":status": "active", ":updatedAt": now },
        })
      );
      break;
    }
    default:
      return badRequest("Unsupported action");
  }

  logger.info("Admin user action applied", { userId: body.userId, action: body.action });

  return ok({ userId: body.userId, status: body.action });
};

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "adminUsers" });

  try {
    await requireRole(event, ROLES.ADMIN);

    if (event.httpMethod === "GET") {
      return await handleList(event, logger);
    }

    if (event.httpMethod === "POST") {
      return await handlePost(event, logger);
    }

    return badRequest("Unsupported method");
  } catch (error) {
    return handleError(error, { handler: "adminUsers", requestId });
  }
};
