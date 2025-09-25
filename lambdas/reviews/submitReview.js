import crypto from "node:crypto";
import { TransactWriteCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { requireRole } from "../common/auth.js";
import { ROLES } from "../common/roles.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { parseJson, getRequestId } from "../common/request.js";
import { created, badRequest, forbidden } from "../common/http.js";

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "submitReview" });

  try {
    const user = await requireRole(event, ROLES.BUYER);
    const body = parseJson(event);

    if (!body.orderId || typeof body.rating !== "number" || body.rating < 1 || body.rating > 5) {
      return badRequest("Invalid review payload");
    }

    const client = getDocumentClient();
    const orderResult = await client.send(
      new GetCommand({
        TableName: process.env.ORDERS_TABLE,
        Key: { orderId: body.orderId },
      })
    );

    if (!orderResult.Item) {
      return badRequest("Order not found");
    }

    if (orderResult.Item.buyerId !== user.id) {
      return forbidden("You cannot review this order");
    }

    if (orderResult.Item.reviewSubmitted) {
      return badRequest("Review already submitted");
    }

    const reviewId = crypto.randomUUID();
    const now = new Date().toISOString();

    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: process.env.REVIEWS_TABLE,
              Item: {
                reviewId,
                orderId: body.orderId,
                plantId: orderResult.Item.plantId,
                sellerId: orderResult.Item.sellerId,
                buyerId: user.id,
                rating: body.rating,
                comment: body.comment ?? null,
                createdAt: now,
              },
            },
          },
          {
            Update: {
              TableName: process.env.ORDERS_TABLE,
              Key: { orderId: body.orderId },
              UpdateExpression: "SET reviewSubmitted = :true",
              ExpressionAttributeValues: { ":true": true },
            },
          },
        ],
      })
    );

    await client.send(
      new UpdateCommand({
        TableName: process.env.SELLER_METRICS_TABLE,
        Key: { sellerId: orderResult.Item.sellerId },
        UpdateExpression:
          "SET #rating = if_not_exists(#rating, :zero) + :rating, #reviewCount = if_not_exists(#reviewCount, :zero) + :one",
        ExpressionAttributeNames: {
          "#rating": "rating",
          "#reviewCount": "reviewCount",
        },
        ExpressionAttributeValues: {
          ":rating": body.rating,
          ":zero": 0,
          ":one": 1,
        },
      })
    );

    logger.info("Review submitted", { reviewId, orderId: body.orderId });

    return created({ reviewId });
  } catch (error) {
    return handleError(error, { handler: "submitReview", requestId });
  }
};
