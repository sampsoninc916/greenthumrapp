import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { parseJson, getRequestId } from "../common/request.js";
import { ok, badRequest } from "../common/http.js";
import { handleError } from "../common/errors.js";
import { createLogger } from "../common/logger.js";
import crypto from "node:crypto";

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "emailConsent" });

  try {
    const body = parseJson(event);
    if (!body.email || !body.channel || typeof body.consented !== "boolean") {
      return badRequest("email, channel, consented required");
    }

    const client = getDocumentClient();
    const now = new Date().toISOString();

    await client.send(
      new UpdateCommand({
        TableName: process.env.EMAIL_CONSENTS_TABLE,
        Key: { email: body.email.toLowerCase() },
        UpdateExpression:
          "SET #preferences.#channel = :consented, #updatedAt = :updatedAt, #history = list_append(if_not_exists(#history, :emptyList), :entry)",
        ExpressionAttributeNames: {
          "#preferences": "preferences",
          "#channel": body.channel,
          "#updatedAt": "updatedAt",
          "#history": "history",
        },
        ExpressionAttributeValues: {
          ":consented": body.consented,
          ":updatedAt": now,
          ":emptyList": [],
          ":entry": [
            {
              eventId: crypto.randomUUID(),
              action: body.consented ? "consent" : "withdraw",
              channel: body.channel,
              occurredAt: now,
            },
          ],
        },
      })
    );

    logger.info("Consent updated", { email: body.email, channel: body.channel });

    return ok({ status: body.consented ? "consented" : "withdrawn" });
  } catch (error) {
    return handleError(error, { handler: "emailConsent", requestId });
  }
};
