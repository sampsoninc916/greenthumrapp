const LEVELS = ["debug", "info", "warn", "error"];

const normalize = (value) => {
  if (value instanceof Error) {
    return {
      message: value.message,
      stack: value.stack,
      name: value.name,
    };
  }

  if (typeof value === "object" && value !== null) {
    return value;
  }

  return { value };
};

export const createLogger = (context = {}) => {
  const base = {
    service: process.env.SERVICE_NAME ?? "thumr-api",
    ...context,
  };

  const log = (level, message, meta) => {
    if (!LEVELS.includes(level)) {
      level = "info";
    }

    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...base,
      ...(meta ? normalize(meta) : {}),
    };

    console[level === "error" ? "error" : "log"](JSON.stringify(payload));
  };

  return {
    debug: (message, meta) => log("debug", message, meta),
    info: (message, meta) => log("info", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    error: (message, meta) => log("error", message, meta),
    child: (additionalContext = {}) =>
      createLogger({ ...base, ...additionalContext }),
  };
};
