import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { verifyAuth } from "../common/auth.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { parseJson, getRequestId } from "../common/request.js";
import { ok, badRequest, forbidden, notFound } from "../common/http.js";

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "markRead" });

  try {
    const user = await verifyAuth(event);
    const body = parseJson(event);

    if (!body.threadId) {
      return badRequest("Missing threadId");
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

    if (!threadResult.Item.participants.includes(user.id)) {
      return forbidden("You do not have access to this thread");
    }

    await client.send(
      new UpdateCommand({
        TableName: process.env.THREADS_TABLE,
        Key: { threadId: body.threadId },
        UpdateExpression: "SET #unreadCounts.#userId = :zero, #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#unreadCounts": "unreadCounts",
          "#userId": user.id,
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":zero": 0,
          ":updatedAt": new Date().toISOString(),
        },
      })
    );

    logger.info("Thread marked read", { threadId: body.threadId, userId: user.id });

    return ok({ threadId: body.threadId });
  } catch (error) {
    return handleError(error, { handler: "markRead", requestId });
  }
};
