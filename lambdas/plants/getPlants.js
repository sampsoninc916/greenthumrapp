import { ScanCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { getQueryParam, getRequestId } from "../common/request.js";
import { ok, badRequest } from "../common/http.js";
import { createPresignedDownloadUrl } from "../common/s3.js";

const buildFilterExpression = (params = {}) => {
  const expressions = [];
  const attributeNames = {};
  const attributeValues = {};

  if (params.category) {
    expressions.push("#category = :category");
    attributeNames["#category"] = "category";
    attributeValues[":category"] = params.category;
  }

  if (params.location) {
    expressions.push("contains(#locations, :location)");
    attributeNames["#locations"] = "serviceAreas";
    attributeValues[":location"] = params.location;
  }

  if (params.deliveryMethod) {
    expressions.push("contains(#deliveryMethods, :deliveryMethod)");
    attributeNames["#deliveryMethods"] = "deliveryMethods";
    attributeValues[":deliveryMethod"] = params.deliveryMethod;
  }

  if (params.keyword) {
    expressions.push("contains(#searchText, :keyword)");
    attributeNames["#searchText"] = "searchText";
    attributeValues[":keyword"] = params.keyword.toLowerCase();
  }

  if (expressions.length === 0) {
    return {};
  }

  return {
    FilterExpression: expressions.join(" AND "),
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  };
};

const attachSignedUrls = async (items = []) => {
  const bucket = process.env.PLANT_IMAGES_BUCKET;
  if (!bucket) {
    return items;
  }

  return Promise.all(
    items.map(async (item) => {
      if (!Array.isArray(item.images) || item.images.length === 0) {
        return item;
      }

      const signedImages = await Promise.all(
        item.images.map(async (imageKey) => ({
          key: imageKey,
          url: await createPresignedDownloadUrl({ bucket, key: imageKey, expiresIn: 900 }),
        }))
      );

      return { ...item, images: signedImages };
    })
  );
};

const fetchSellerMetrics = async (sellerIds) => {
  const uniqueIds = Array.from(new Set(sellerIds)).filter(Boolean);
  if (uniqueIds.length === 0) {
    return {};
  }

  const client = getDocumentClient();
  const tableName = process.env.SELLER_METRICS_TABLE;
  if (!tableName) {
    return {};
  }

  const response = await client.send(
    new BatchGetCommand({
      RequestItems: {
        [tableName]: {
          Keys: uniqueIds.map((sellerId) => ({ sellerId })),
        },
      },
    })
  );

  const metrics = response.Responses?.[tableName] ?? [];
  return metrics.reduce((acc, metric) => {
    acc[metric.sellerId] = metric;
    return acc;
  }, {});
};

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "getPlants" });

  try {
    const limitParam = getQueryParam(event, "limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;
    if (Number.isNaN(limit) || limit <= 0 || limit > 100) {
      return badRequest("Invalid limit parameter");
    }

    const lastKey = getQueryParam(event, "cursor");
    const filter = buildFilterExpression({
      category: getQueryParam(event, "category"),
      location: getQueryParam(event, "location"),
      deliveryMethod: getQueryParam(event, "delivery"),
      keyword: getQueryParam(event, "q"),
    });

    const client = getDocumentClient();

    const params = {
      TableName: process.env.PLANTS_TABLE,
      Limit: limit,
      ExclusiveStartKey: lastKey ? { id: lastKey } : undefined,
      ...filter,
    };

    const response = await client.send(new ScanCommand(params));

    const items = response.Items ?? [];
    const sellerMetrics = await fetchSellerMetrics(items.map((item) => item.sellerId));
    const withUrls = await attachSignedUrls(items);

    const sanitized = withUrls.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      species: item.species,
      cultivar: item.cultivar,
      size: item.size,
      light: item.light,
      water: item.water,
      care: item.care,
      description: item.description,
      sellerId: item.sellerId,
      sellerDisplayName: item.sellerDisplayName,
      deliveryMethods: item.deliveryMethods,
      serviceAreas: item.serviceAreas,
      warranty: item.warranty,
      compliance: item.compliance,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      status: item.status,
      images: item.images,
      sellerRating: sellerMetrics[item.sellerId]?.rating ?? null,
      reviewCount: sellerMetrics[item.sellerId]?.reviewCount ?? 0,
    }));

    return ok({
      items: sanitized,
      nextCursor: response.LastEvaluatedKey?.id ?? null,
    });
  } catch (error) {
    return handleError(error, { handler: "getPlants", requestId });
  }
};
