import crypto from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { createPresignedUploadUrl } from "../common/s3.js";
import { handleError } from "../common/errors.js";
import { parseJson, getRequestId } from "../common/request.js";
import { created, badRequest } from "../common/http.js";
import { requireRole } from "../common/auth.js";
import { ROLES } from "../common/roles.js";
import { createLogger } from "../common/logger.js";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = Number(process.env.UPLOAD_MAX_BYTES ?? 10_000_000);

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "createPresignUrl" });

  try {
    const user = await requireRole(event, ROLES.SELLER);
    const body = parseJson(event);

    if (!ALLOWED_MIME_TYPES.includes(body.contentType)) {
      return badRequest("Unsupported file type");
    }

    if (body.size > MAX_FILE_SIZE) {
      return badRequest("File too large");
    }

    const bucket = process.env.UPLOADS_BUCKET;
    if (!bucket) {
      return badRequest("Uploads bucket not configured");
    }

    const key = `${user.id}/${crypto.randomUUID()}`;
    const uploadUrl = await createPresignedUploadUrl({
      bucket,
      key,
      contentType: body.contentType,
      expiresIn: Number(process.env.UPLOAD_URL_TTL ?? 900),
    });

    const client = getDocumentClient();
    const ttlSeconds = Math.floor(Date.now() / 1000) + Number(process.env.UPLOAD_RECORD_TTL ?? 3600);

    await client.send(
      new PutCommand({
        TableName: process.env.UPLOADS_TABLE,
        Item: {
          uploadId: key,
          userId: user.id,
          status: "pending",
          contentType: body.contentType,
          size: body.size,
          createdAt: new Date().toISOString(),
          expiresAt: ttlSeconds,
        },
      })
    );

    logger.info("Upload presign generated", { key, userId: user.id });

    return created({
      uploadId: key,
      uploadUrl,
      bucket,
      key,
    });
  } catch (error) {
    return handleError(error, { handler: "createPresignUrl", requestId });
  }
};
