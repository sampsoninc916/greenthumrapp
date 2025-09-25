import { parseJson, getRequestId } from "../common/request.js";
import { ok, badRequest } from "../common/http.js";
import { handleError } from "../common/errors.js";
import { createLogger } from "../common/logger.js";
import { sendTemplatedEmail } from "../common/email.js";

const TEMPLATE_MAP = {
  welcome: "thumr-welcome",
  reviewReminder: "thumr-review-reminder",
  sellerActivation: "thumr-seller-activation",
};

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "emailLifecycle" });

  try {
    const body = parseJson(event);
    if (!body.email || !body.eventType) {
      return badRequest("email and eventType are required");
    }

    const templateName = TEMPLATE_MAP[body.eventType];
    if (!templateName) {
      return badRequest("Unsupported event type");
    }

    await sendTemplatedEmail({
      toAddress: body.email,
      templateName,
      templateData: body.templateData ?? {},
    });

    logger.info("Lifecycle email sent", { email: body.email, eventType: body.eventType });

    return ok({ status: "queued" });
  } catch (error) {
    return handleError(error, { handler: "emailLifecycle", requestId });
  }
};
