export const requireFields = (payload, fields) => {
  const missing = fields.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === "");

  if (missing.length > 0) {
    return {
      valid: false,
      missing,
    };
  }

  return { valid: true };
};

export const assertValid = (result, message = "Validation failed") => {
  if (!result.valid) {
    const error = new Error(message);
    error.statusCode = 400;
    error.details = result;
    throw error;
  }
};
