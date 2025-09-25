import crypto from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "../common/dynamo.js";
import { requireRole } from "../common/auth.js";
import { ROLES } from "../common/roles.js";
import { createLogger } from "../common/logger.js";
import { handleError } from "../common/errors.js";
import { parseJson, getRequestId } from "../common/request.js";
import { created, badRequest } from "../common/http.js";

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "createAuditEvent" });

  try {
    const user = await requireRole(event, ROLES.ADMIN);
    const body = parseJson(event);

    if (!body.action || !body.entityId || !body.entityType) {
      return badRequest("Missing audit fields");
    }

    const client = getDocumentClient();
    const auditId = crypto.randomUUID();
    const now = new Date().toISOString();

    await client.send(
      new PutCommand({
        TableName: process.env.AUDIT_TABLE,
        Item: {
          auditId,
          actorId: user.id,
          actorEmail: user.email,
          action: body.action,
          entityId: body.entityId,
          entityType: body.entityType,
          metadata: body.metadata ?? {},
          createdAt: now,
        },
      })
    );

    logger.info("Audit event recorded", { auditId, action: body.action });

    return created({ auditId });
  } catch (error) {
    return handleError(error, { handler: "createAuditEvent", requestId });
  }
};
