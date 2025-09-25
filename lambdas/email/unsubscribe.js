import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { parseJson, getRequestId } from "../common/request.js";
import { ok, badRequest } from "../common/http.js";
import { handleError } from "../common/errors.js";
import { createLogger } from "../common/logger.js";
import crypto from "node:crypto";

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "emailUnsubscribe" });

  try {
    const body = parseJson(event);
    if (!body.email) {
      return badRequest("Email is required");
    }

    const client = getDocumentClient();
    const now = new Date().toISOString();

    await client.send(
      new UpdateCommand({
        TableName: process.env.EMAIL_CONSENTS_TABLE,
        Key: { email: body.email.toLowerCase() },
        UpdateExpression:
          "SET #status = :status, #updatedAt = :updatedAt, #history = list_append(if_not_exists(#history, :emptyList), :entry)",
        ExpressionAttributeNames: {
          "#status": "status",
          "#updatedAt": "updatedAt",
          "#history": "history",
        },
        ExpressionAttributeValues: {
          ":status": "unsubscribed",
          ":updatedAt": now,
          ":emptyList": [],
          ":entry": [
            {
              eventId: crypto.randomUUID(),
              action: "unsubscribe",
              channel: body.channel ?? "newsletter",
              occurredAt: now,
            },
          ],
        },
      })
    );

    logger.info("Email unsubscribed", { email: body.email });

    return ok({ status: "unsubscribed" });
  } catch (error) {
    return handleError(error, { handler: "emailUnsubscribe", requestId });
  }
};
