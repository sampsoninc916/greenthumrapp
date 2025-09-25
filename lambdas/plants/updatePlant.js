import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { parseJson, getPathParam, getRequestId } from "../common/request.js";
import { ok, badRequest, notFound, forbidden } from "../common/http.js";
import { verifyAuth } from "../common/auth.js";
import { ROLES, hasRole } from "../common/roles.js";

const ALLOWED_FIELDS = new Set([
  "price",
  "care",
  "description",
  "images",
  "deliveryMethods",
  "serviceAreas",
  "status",
  "warranty",
  "compliance",
  "light",
  "water",
  "size",
]);

const buildUpdateExpression = (payload) => {
  const keys = Object.keys(payload).filter((key) => ALLOWED_FIELDS.has(key));
  if (keys.length === 0) {
    return null;
  }

  const expressionParts = [];
  const names = {};
  const values = {};

  keys.forEach((key, index) => {
    const attributeKey = `#field${index}`;
    const valueKey = `:value${index}`;
    expressionParts.push(`${attributeKey} = ${valueKey}`);
    names[attributeKey] = key;
    values[valueKey] = payload[key];
  });

  expressionParts.push(`#updatedAt = :updatedAt`);
  names["#updatedAt"] = "updatedAt";
  values[":updatedAt"] = new Date().toISOString();

  return {
    UpdateExpression: `SET ${expressionParts.join(", ")}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
};

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "updatePlant" });

  try {
    const user = await verifyAuth(event);
    const plantId = getPathParam(event, "id");
    if (!plantId) {
      return badRequest("Missing plant ID");
    }

    const client = getDocumentClient();
    const existing = await client.send(
      new GetCommand({
        TableName: process.env.PLANTS_TABLE,
        Key: { id: plantId },
      })
    );

    if (!existing.Item) {
      return notFound("Plant not found");
    }

    if (existing.Item.sellerId !== user.id && !hasRole(user, ROLES.ADMIN)) {
      return forbidden("You cannot modify this listing");
    }

    const body = parseJson(event);
    const update = buildUpdateExpression(body);

    if (!update) {
      return badRequest("No updatable fields provided");
    }

    if (body.status && !["draft", "published", "archived"].includes(body.status)) {
      return badRequest("Invalid status value");
    }

    await client.send(
      new UpdateCommand({
        TableName: process.env.PLANTS_TABLE,
        Key: { id: plantId },
        ConditionExpression: "attribute_exists(id)",
        ...update,
      })
    );

    logger.info("Plant updated", { plantId, userId: user.id, changes: Object.keys(body) });

    return ok({ id: plantId });
  } catch (error) {
    return handleError(error, { handler: "updatePlant", requestId });
  }
};
