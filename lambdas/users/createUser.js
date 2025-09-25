import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { verifyAuth } from "../common/auth.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { parseJson, getRequestId } from "../common/request.js";
import { created } from "../common/http.js";
import { requireFields, assertValid } from "../common/validation.js";

const REQUIRED_FIELDS = ["role", "displayName", "consents"];

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "createUser" });

  try {
    const user = await verifyAuth(event);
    const body = parseJson(event);
    assertValid(requireFields(body, REQUIRED_FIELDS), "Missing required user fields");

    const now = new Date().toISOString();

    const profile = {
      userId: user.id,
      email: user.email,
      role: body.role,
      displayName: body.displayName,
      consents: body.consents,
      preferences: body.preferences ?? {},
      createdAt: now,
      updatedAt: now,
      status: "active",
    };

    const client = getDocumentClient();
    await client.send(
      new PutCommand({
        TableName: process.env.USERS_TABLE,
        Item: profile,
        ConditionExpression: "attribute_not_exists(userId)",
      })
    );

    logger.info("User profile created", { userId: user.id });
    return created({ userId: user.id });
  } catch (error) {
    return handleError(error, { handler: "createUser", requestId });
  }
};
