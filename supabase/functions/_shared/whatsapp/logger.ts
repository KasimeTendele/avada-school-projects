/** Structured JSON logger. Every line includes the module for easy filtering. */
type Level = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug: (msg: string, meta?: unknown) => void;
  info: (msg: string, meta?: unknown) => void;
  warn: (msg: string, meta?: unknown) => void;
  error: (msg: string, meta?: unknown) => void;
  child: (context: string) => Logger;
}

function emit(level: Level, module: string, msg: string, meta?: unknown) {
  const line = {
    ts: new Date().toISOString(),
    level,
    module,
    msg,
    ...(meta !== undefined ? { meta } : {}),
  };
  const s = JSON.stringify(line);
  if (level === "error") console.error(s);
  else if (level === "warn") console.warn(s);
  else console.log(s);
}

export function createLogger(module: string): Logger {
  return {
    debug: (m, meta) => emit("debug", module, m, meta),
    info: (m, meta) => emit("info", module, m, meta),
    warn: (m, meta) => emit("warn", module, m, meta),
    error: (m, meta) => emit("error", module, m, meta),
    child: (ctx) => createLogger(`${module}:${ctx}`),
  };
}