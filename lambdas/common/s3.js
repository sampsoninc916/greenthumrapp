import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

let s3Client;

export const getS3Client = () => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION,
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: Boolean(process.env.S3_FORCE_PATH_STYLE),
    });
  }

  return s3Client;
};

export const createPresignedUploadUrl = async ({
  bucket,
  key,
  contentType,
  expiresIn = 900,
}) => {
  const client = getS3Client();
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn });
};

export const createPresignedDownloadUrl = async ({
  bucket,
  key,
  expiresIn = 900,
}) => {
  const client = getS3Client();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn });
};

export const deleteObject = async ({ bucket, key }) => {
  const client = getS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};
