import { ScanCommand, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { requireRole } from "../common/auth.js";
import { ROLES } from "../common/roles.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { parseJson, getQueryParam, getRequestId } from "../common/request.js";
import { ok, badRequest } from "../common/http.js";
import crypto from "node:crypto";

const handleList = async (event) => {
  const client = getDocumentClient();
  const status = getQueryParam(event, "status");

  const params = {
    TableName: process.env.DISPUTES_TABLE,
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

  if (event.path?.endsWith("/admin/disputes") && body.orderId && !body.disputeId) {
    const disputeId = crypto.randomUUID();
    const now = new Date().toISOString();
    const client = getDocumentClient();

    await client.send(
      new PutCommand({
        TableName: process.env.DISPUTES_TABLE,
        Item: {
          disputeId,
          orderId: body.orderId,
          sellerId: body.sellerId,
          buyerId: body.buyerId,
          status: "open",
          notes: body.notes ?? [],
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    logger.info("Dispute created", { disputeId, orderId: body.orderId });
    return ok({ disputeId, status: "open" });
  }

  if (!body.disputeId || !body.action) {
    return badRequest("disputeId and action are required");
  }

  const client = getDocumentClient();
  const now = new Date().toISOString();

  const updates = {
    resolve: { status: "resolved" },
    escalate: { status: "escalated" },
    close: { status: "closed" },
  };

  const target = updates[body.action];
  if (!target) {
    return badRequest("Unsupported action");
  }

  const expressionParts = ["#status = :status", "#updatedAt = :updatedAt"];
  const names = { "#status": "status", "#updatedAt": "updatedAt" };
  const values = { ":status": target.status, ":updatedAt": now };

  if (body.note) {
    expressionParts.push("#notes = list_append(if_not_exists(#notes, :emptyList), :newNote)");
    names["#notes"] = "notes";
    values[":emptyList"] = [];
    values[":newNote"] = [
      {
        noteId: crypto.randomUUID(),
        message: body.note,
        createdAt: now,
      },
    ];
  }

  await client.send(
    new UpdateCommand({
      TableName: process.env.DISPUTES_TABLE,
      Key: { disputeId: body.disputeId },
      UpdateExpression: `SET ${expressionParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );

  logger.info("Dispute updated", { disputeId: body.disputeId, action: body.action });

  return ok({ disputeId: body.disputeId, status: target.status });
};

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "adminDisputes" });

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
    return handleError(error, { handler: "adminDisputes", requestId });
  }
};
