import crypto from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { parseJson, getRequestId } from "../common/request.js";
import { created, badRequest } from "../common/http.js";
import { requireRole } from "../common/auth.js";
import { ROLES } from "../common/roles.js";
import { requireFields, assertValid } from "../common/validation.js";

const REQUIRED_FIELDS = [
  "name",
  "price",
  "species",
  "size",
  "care",
  "deliveryMethods",
  "serviceAreas",
];

const sanitizePayload = (payload) => ({
  id: crypto.randomUUID(),
  name: payload.name,
  price: Number(payload.price),
  species: payload.species,
  cultivar: payload.cultivar ?? null,
  taxonomy: payload.taxonomy ?? null,
  size: payload.size,
  care: payload.care,
  light: payload.light ?? null,
  water: payload.water ?? null,
  description: payload.description ?? null,
  images: Array.isArray(payload.images) ? payload.images : [],
  deliveryMethods: payload.deliveryMethods,
  serviceAreas: payload.serviceAreas,
  warranty: payload.warranty ?? null,
  compliance: payload.compliance ?? null,
  sellerDisplayName: payload.sellerDisplayName ?? null,
  status: "draft",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "createPlant" });

  try {
    const user = await requireRole(event, ROLES.SELLER);
    const body = parseJson(event);
    assertValid(requireFields(body, REQUIRED_FIELDS), "Missing required plant fields");

    if (!Array.isArray(body.images) || body.images.length === 0) {
      return badRequest("At least one image is required");
    }

    if (!Array.isArray(body.deliveryMethods) || body.deliveryMethods.length === 0) {
      return badRequest("Delivery or pickup option required");
    }

    const plant = sanitizePayload(body);
    plant.sellerId = user.id;
    plant.sellerDisplayName = body.sellerDisplayName ?? user.email;
    plant.searchText = [plant.name, plant.species, plant.cultivar, plant.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const client = getDocumentClient();
    await client.send(
      new PutCommand({
        TableName: process.env.PLANTS_TABLE,
        Item: plant,
      })
    );

    logger.info("Plant created", { plantId: plant.id, sellerId: user.id });

    return created({ id: plant.id, status: plant.status });
  } catch (error) {
    return handleError(error, { handler: "createPlant", requestId });
  }
};
