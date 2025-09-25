import { SESv2Client, ListEmailTemplatesCommand } from "@aws-sdk/client-sesv2";
import { ok } from "../common/http.js";
import { handleError } from "../common/errors.js";
import { createLogger } from "../common/logger.js";

let client;

const getClient = () => {
  if (!client) {
    client = new SESv2Client({ region: process.env.AWS_REGION });
  }
  return client;
};

export const handler = async (event = {}) => {
  const logger = createLogger({ handler: "emailTemplatesSync" });

  try {
    const response = await getClient().send(
      new ListEmailTemplatesCommand({ PageSize: 50 })
    );

    return ok({ templates: response.TemplatesMetadata ?? [] });
  } catch (error) {
    return handleError(error, { handler: "emailTemplatesSync" });
  }
};
