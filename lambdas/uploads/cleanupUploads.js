import { ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { deleteObject } from "../common/s3.js";

const batch = (items, size) => {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

export const handler = async () => {
  const logger = createLogger({ handler: "cleanupUploads" });

  try {
    const client = getDocumentClient();
    const now = Math.floor(Date.now() / 1000);

    const scan = await client.send(
      new ScanCommand({
        TableName: process.env.UPLOADS_TABLE,
        FilterExpression: "#status = :status AND #expiresAt < :now",
        ExpressionAttributeNames: {
          "#status": "status",
          "#expiresAt": "expiresAt",
        },
        ExpressionAttributeValues: {
          ":status": "pending",
          ":now": now,
        },
      })
    );

    const expired = scan.Items ?? [];

    for (const chunk of batch(expired, 25)) {
      await Promise.all(
        chunk.map(async (record) => {
          await client.send(
            new DeleteCommand({
              TableName: process.env.UPLOADS_TABLE,
              Key: { uploadId: record.uploadId },
            })
          );

          await deleteObject({ bucket: process.env.UPLOADS_BUCKET, key: record.uploadId });
          logger.info("Expired upload cleaned", { uploadId: record.uploadId });
        })
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ removed: expired.length }),
    };
  } catch (error) {
    return handleError(error, { handler: "cleanupUploads" });
  }
};
