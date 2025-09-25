import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { verifyAuth } from "../common/auth.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { getRequestId } from "../common/request.js";
import { ok, notFound } from "../common/http.js";

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "getCurrentUser" });

  try {
    const user = await verifyAuth(event);

    const client = getDocumentClient();
    const response = await client.send(
      new GetCommand({
        TableName: process.env.USERS_TABLE,
        Key: { userId: user.id },
      })
    );

    if (!response.Item) {
      logger.warn("User profile missing", { userId: user.id });
      return notFound("Profile not found");
    }

    const profile = response.Item;
    delete profile.internalNotes;

    return ok(profile);
  } catch (error) {
    return handleError(error, { handler: "getCurrentUser", requestId });
  }
};
