import crypto from "node:crypto";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { verifyAuth } from "../common/auth.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { parseJson, getRequestId } from "../common/request.js";
import { created, badRequest } from "../common/http.js";

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "createThread" });

  try {
    const user = await verifyAuth(event);
    const body = parseJson(event);

    if (!body.plantId || !body.recipientId || !body.message) {
      return badRequest("Missing required fields");
    }

    const threadId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    const client = getDocumentClient();

    const thread = {
      threadId,
      plantId: body.plantId,
      createdAt: now,
      updatedAt: now,
      participants: [user.id, body.recipientId],
      lastMessagePreview: body.message.slice(0, 140),
      lastSenderId: user.id,
      unreadCounts: {
        [body.recipientId]: 1,
        [user.id]: 0,
      },
    };

    await client.send(
      new PutCommand({
        TableName: process.env.THREADS_TABLE,
        Item: thread,
      })
    );

    await client.send(
      new PutCommand({
        TableName: process.env.MESSAGES_TABLE,
        Item: {
          threadId,
          messageId,
          senderId: user.id,
          recipientId: body.recipientId,
          body: body.message,
          attachments: body.attachments ?? [],
          createdAt: now,
          readBy: [user.id],
        },
      })
    );

    logger.info("Message thread created", { threadId, userId: user.id });

    return created({ threadId, messageId });
  } catch (error) {
    return handleError(error, { handler: "createThread", requestId });
  }
};
