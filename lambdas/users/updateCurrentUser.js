import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { verifyAuth } from "../common/auth.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { parseJson, getRequestId } from "../common/request.js";
import { ok, badRequest } from "../common/http.js";

const ALLOWED_FIELDS = new Set(["displayName", "consents", "preferences", "addresses", "phone"]);

const buildUpdateExpression = (payload) => {
  const keys = Object.keys(payload).filter((key) => ALLOWED_FIELDS.has(key));
  if (keys.length === 0) {
    return null;
  }

  const expressions = [];
  const names = { "#updatedAt": "updatedAt" };
  const values = { ":updatedAt": new Date().toISOString() };

  keys.forEach((key, index) => {
    const nameKey = `#field${index}`;
    const valueKey = `:value${index}`;
    expressions.push(`${nameKey} = ${valueKey}`);
    names[nameKey] = key;
    values[valueKey] = payload[key];
  });

  return {
    UpdateExpression: `SET ${expressions.join(", ")}, #updatedAt = :updatedAt`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
};

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "updateCurrentUser" });

  try {
    const user = await verifyAuth(event);
    const body = parseJson(event);
    const update = buildUpdateExpression(body);

    if (!update) {
      return badRequest("No updatable fields provided");
    }

    const client = getDocumentClient();
    await client.send(
      new UpdateCommand({
        TableName: process.env.USERS_TABLE,
        Key: { userId: user.id },
        ConditionExpression: "attribute_exists(userId)",
        ...update,
      })
    );

    logger.info("User profile updated", { userId: user.id, fields: Object.keys(body) });

    return ok({ userId: user.id });
  } catch (error) {
    return handleError(error, { handler: "updateCurrentUser", requestId });
  }
};
