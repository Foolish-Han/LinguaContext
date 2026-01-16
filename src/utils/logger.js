const ENABLE_LOGS = true;

export const Logger = {
  info: (...args) => {
    if (ENABLE_LOGS) console.log("[LinguaContext]", ...args);
  },
  warn: (...args) => {
    if (ENABLE_LOGS) console.warn("[LinguaContext]", ...args);
  },
  error: (...args) => {
    if (ENABLE_LOGS) console.error("[LinguaContext]", ...args);
  }
};
