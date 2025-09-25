import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { requireRole } from "../common/auth.js";
import { ROLES } from "../common/roles.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { parseJson, getQueryParam, getRequestId } from "../common/request.js";
import { ok, badRequest } from "../common/http.js";

const handleList = async (event) => {
  const client = getDocumentClient();
  const status = getQueryParam(event, "status") ?? "pending";

  const response = await client.send(
    new ScanCommand({
      TableName: process.env.PLANTS_TABLE,
      FilterExpression: "#status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status },
    })
  );

  return ok({ items: response.Items ?? [] });
};

const handlePost = async (event, logger) => {
  const body = parseJson(event);

  if (!body.plantId || !body.action) {
    return badRequest("plantId and action are required");
  }

  const client = getDocumentClient();
  const now = new Date().toISOString();
  const updates = {
    approve: {
      status: "published",
    },
    reject: {
      status: "rejected",
      moderationNotes: body.reason ?? null,
    },
    flag: {
      status: "flagged",
      moderationNotes: body.reason ?? null,
    },
  };

  const target = updates[body.action];
  if (!target) {
    return badRequest("Unsupported action");
  }

  const expressionParts = ["#updatedAt = :updatedAt", "#status = :status"];
  const names = { "#updatedAt": "updatedAt", "#status": "status" };
  const values = { ":updatedAt": now, ":status": target.status };

  if (target.moderationNotes !== undefined) {
    expressionParts.push("#moderationNotes = :moderationNotes");
    names["#moderationNotes"] = "moderationNotes";
    values[":moderationNotes"] = target.moderationNotes;
  }

  await client.send(
    new UpdateCommand({
      TableName: process.env.PLANTS_TABLE,
      Key: { id: body.plantId },
      UpdateExpression: `SET ${expressionParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );

  logger.info("Admin listing action applied", { plantId: body.plantId, action: body.action });

  return ok({ plantId: body.plantId, status: target.status });
};

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "adminListings" });

  try {
    await requireRole(event, ROLES.ADMIN);

    if (event.httpMethod === "GET") {
      return await handleList(event);
    }

    if (event.httpMethod === "POST") {
      return await handlePost(event, logger);
    }

    return badRequest("Unsupported method");
  } catch (error) {
    return handleError(error, { handler: "adminListings", requestId });
  }
};
