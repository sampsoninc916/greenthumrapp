import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { handleError } from "../common/errors.js";
import { getQueryParam, getRequestId } from "../common/request.js";
import { ok, badRequest } from "../common/http.js";
import { createLogger } from "../common/logger.js";

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "getReviewSummary" });

  try {
    const sellerId = getQueryParam(event, "sellerId");
    if (!sellerId) {
      return badRequest("sellerId is required");
    }

    const client = getDocumentClient();
    const response = await client.send(
      new QueryCommand({
        TableName: process.env.REVIEWS_TABLE,
        IndexName: process.env.REVIEWS_SELLER_INDEX ?? "SellerIdIndex",
        KeyConditionExpression: "sellerId = :sellerId",
        ExpressionAttributeValues: {
          ":sellerId": sellerId,
        },
        ProjectionExpression: "rating",
      })
    );

    const reviews = response.Items ?? [];
    const count = reviews.length;
    const average = count === 0 ? null : reviews.reduce((acc, item) => acc + item.rating, 0) / count;

    return ok({ sellerId, reviewCount: count, averageRating: average });
  } catch (error) {
    return handleError(error, { handler: "getReviewSummary", requestId });
  }
};
