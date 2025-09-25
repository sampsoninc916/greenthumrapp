import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { handleError } from "../common/errors.js";
import { parseJson, getRequestId } from "../common/request.js";
import { ok, badRequest, notFound } from "../common/http.js";
import { createLogger } from "../common/logger.js";
import { deleteObject } from "../common/s3.js";

const VALID_RESULTS = new Set(["approved", "rejected"]);

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "scanUpload" });

  try {
    const body = parseJson(event);

    if (!body.uploadId || !VALID_RESULTS.has(body.status)) {
      return badRequest("Invalid scan payload");
    }

    const client = getDocumentClient();
    const record = await client.send(
      new GetCommand({
        TableName: process.env.UPLOADS_TABLE,
        Key: { uploadId: body.uploadId },
      })
    );

    if (!record.Item) {
      return notFound("Upload not found");
    }

    const update = {
      TableName: process.env.UPLOADS_TABLE,
      Key: { uploadId: body.uploadId },
      UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt, #reason = :reason",
      ExpressionAttributeNames: {
        "#status": "status",
        "#updatedAt": "updatedAt",
        "#reason": "scanMessage",
      },
      ExpressionAttributeValues: {
        ":status": body.status,
        ":updatedAt": new Date().toISOString(),
        ":reason": body.message ?? null,
      },
    };

    await client.send(new UpdateCommand(update));

    if (body.status === "rejected") {
      await deleteObject({ bucket: process.env.UPLOADS_BUCKET, key: body.uploadId });
    }

    logger.info("Upload scan processed", { uploadId: body.uploadId, status: body.status });

    return ok({ uploadId: body.uploadId, status: body.status });
  } catch (error) {
    return handleError(error, { handler: "scanUpload", requestId });
  }
};
