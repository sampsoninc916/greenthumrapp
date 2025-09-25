import crypto from "node:crypto";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { verifyAuth } from "../common/auth.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { parseJson, getRequestId } from "../common/request.js";
import { ok, badRequest, forbidden, notFound } from "../common/http.js";

const isParticipant = (thread, userId) => thread.participants?.includes(userId);

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "sendMessage" });

  try {
    const user = await verifyAuth(event);
    const body = parseJson(event);

    if (!body.threadId || !body.message) {
      return badRequest("Missing required fields");
    }

    const client = getDocumentClient();
    const threadResult = await client.send(
      new GetCommand({
        TableName: process.env.THREADS_TABLE,
        Key: { threadId: body.threadId },
      })
    );

    if (!threadResult.Item) {
      return notFound("Thread not found");
    }

    if (!isParticipant(threadResult.Item, user.id)) {
      return forbidden("You do not have access to this thread");
    }

    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    await client.send(
      new PutCommand({
        TableName: process.env.MESSAGES_TABLE,
        Item: {
          threadId: body.threadId,
          messageId,
          senderId: user.id,
          body: body.message,
          createdAt: now,
          attachments: body.attachments ?? [],
          readBy: [user.id],
        },
      })
    );

    const recipientIds = threadResult.Item.participants.filter((id) => id !== user.id);

    await client.send(
      new UpdateCommand({
        TableName: process.env.THREADS_TABLE,
        Key: { threadId: body.threadId },
        UpdateExpression:
          "SET #updatedAt = :updatedAt, #lastMessagePreview = :preview, #lastSenderId = :sender, #unreadCounts.#recipient = if_not_exists(#unreadCounts.#recipient, :zero) + :increment",
        ExpressionAttributeNames: {
          "#updatedAt": "updatedAt",
          "#lastMessagePreview": "lastMessagePreview",
          "#lastSenderId": "lastSenderId",
          "#unreadCounts": "unreadCounts",
          "#recipient": recipientIds[0],
        },
        ExpressionAttributeValues: {
          ":updatedAt": now,
          ":preview": body.message.slice(0, 140),
          ":sender": user.id,
          ":increment": 1,
          ":zero": 0,
        },
      })
    );

    logger.info("Message sent", { threadId: body.threadId, messageId, userId: user.id });

    return ok({ messageId });
  } catch (error) {
    return handleError(error, { handler: "sendMessage", requestId });
  }
};
