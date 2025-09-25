import { CognitoJwtVerifier } from "aws-jwt-verify";
import { createLogger } from "./logger.js";
import { unauthorized, forbidden } from "./http.js";

let verifier;

const getVerifier = () => {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      tokenUse: "id",
      clientId: process.env.COGNITO_APP_CLIENT_ID,
    });
  }

  return verifier;
};

export const verifyAuth = async (event, { requireRole } = {}) => {
  const logger = createLogger({ scope: "auth" });

  const token =
    event.headers?.Authorization?.replace(/Bearer\s+/i, "") ||
    event.headers?.authorization?.replace(/Bearer\s+/i, "");

  if (!token) {
    logger.warn("Missing authorization token");
    throw unauthorized();
  }

  try {
    const payload = await getVerifier().verify(token);
    const user = {
      id: payload.sub,
      email: payload.email,
      roles: Array.isArray(payload["custom:roles"])
        ? payload["custom:roles"]
        : payload["custom:roles"]?.split(",").map((role) => role.trim()).filter(Boolean) ?? [],
    };

    if (requireRole && !user.roles.includes(requireRole)) {
      logger.warn("User missing required role", { userId: user.id, requireRole });
      throw forbidden();
    }

    return user;
  } catch (error) {
    logger.error("Failed to verify token", error);
    throw unauthorized();
  }
};

export const requireRole = (event, role) => verifyAuth(event, { requireRole: role });
