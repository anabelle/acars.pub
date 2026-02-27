export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

type LogMethod = (...args: unknown[]) => void;

const levelRank: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const normalizeLevel = (value?: string | null): LogLevel | null => {
  if (!value) return null;
  const lowered = value.toLowerCase();
  if (lowered in levelRank) return lowered as LogLevel;
  return null;
};

const resolveLogLevel = (): LogLevel => {
  const globalValue = (globalThis as { ACARS_LOG_LEVEL?: string }).ACARS_LOG_LEVEL;
  const globalProcess = (globalThis as { process?: { env?: Record<string, string> } }).process;
  const processValue = globalProcess?.env?.ACARS_LOG_LEVEL;
  return normalizeLevel(globalValue) ?? normalizeLevel(processValue) ?? "info";
};

const makeMethod = (
  threshold: number,
  level: LogLevel,
  fn: LogMethod,
  prefix?: string,
): LogMethod => {
  if (threshold < levelRank[level]) return () => undefined;
  if (!prefix) return fn;
  return (...args: unknown[]) => fn(prefix, ...args);
};

export const createLogger = (scope?: string, level?: LogLevel) => {
  const resolved = level ?? resolveLogLevel();
  const threshold = levelRank[resolved] ?? levelRank.info;
  const prefix = scope ? `[${scope}]` : undefined;

  return {
    debug: makeMethod(threshold, "debug", console.debug.bind(console), prefix),
    info: makeMethod(threshold, "info", console.info.bind(console), prefix),
    warn: makeMethod(threshold, "warn", console.warn.bind(console), prefix),
    error: makeMethod(threshold, "error", console.error.bind(console), prefix),
  };
};
