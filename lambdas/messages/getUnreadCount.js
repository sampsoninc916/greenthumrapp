import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { verifyAuth } from "../common/auth.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { getRequestId } from "../common/request.js";
import { ok } from "../common/http.js";

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "getUnreadCount" });

  try {
    const user = await verifyAuth(event);
    const client = getDocumentClient();

    const response = await client.send(
      new ScanCommand({
        TableName: process.env.THREADS_TABLE,
        ProjectionExpression: "threadId, unreadCounts",
        FilterExpression: "contains(participants, :userId)",
        ExpressionAttributeValues: {
          ":userId": user.id,
        },
      })
    );

    const threads = response.Items ?? [];
    const total = threads.reduce((acc, thread) => acc + (thread.unreadCounts?.[user.id] ?? 0), 0);

    return ok({ unread: total });
  } catch (error) {
    return handleError(error, { handler: "getUnreadCount", requestId });
  }
};
