import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger.js";

const originalDebug = console.debug;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  console.debug = vi.fn();
  console.info = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
  delete (globalThis as { ACARS_LOG_LEVEL?: string }).ACARS_LOG_LEVEL;
});

afterEach(() => {
  console.debug = originalDebug;
  console.info = originalInfo;
  console.warn = originalWarn;
  console.error = originalError;
});

describe("createLogger", () => {
  it("logs at info level by default", () => {
    const log = createLogger();
    log.info("hello");
    expect(console.info).toHaveBeenCalledOnce();
  });

  it("respects explicit level argument", () => {
    const log = createLogger(undefined, "warn");
    log.info("should-be-suppressed");
    log.warn("allowed");
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("prefixes messages with the scope bracket", () => {
    const log = createLogger("WorldSync");
    log.error("boom");
    expect(console.error).toHaveBeenCalledWith("[WorldSync]", "boom");
  });

  it("does not prefix when no scope is given", () => {
    const log = createLogger();
    log.error("plain");
    expect(console.error).toHaveBeenCalledWith("plain");
  });

  it("silences everything at silent level", () => {
    const log = createLogger("scope", "silent");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("emits all severities at debug level", () => {
    const log = createLogger("s", "debug");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(console.debug).toHaveBeenCalledOnce();
    expect(console.info).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("reads ACARS_LOG_LEVEL from globalThis", () => {
    (globalThis as { ACARS_LOG_LEVEL?: string }).ACARS_LOG_LEVEL = "error";
    const log = createLogger();
    log.warn("suppressed");
    log.error("shown");
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("reads ACARS_LOG_LEVEL from process.env as fallback", () => {
    const prev = process.env.ACARC_LOG_LEVEL;
    process.env.ACARS_LOG_LEVEL = "warn";
    try {
      const log = createLogger();
      log.info("suppressed");
      log.warn("shown");
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledOnce();
    } finally {
      if (prev === undefined) delete process.env.ACARS_LOG_LEVEL;
      else process.env.ACARS_LOG_LEVEL = prev;
    }
  });

  it("falls back to info when level value is invalid", () => {
    (globalThis as { ACARS_LOG_LEVEL?: string }).ACARS_LOG_LEVEL = "not-a-level";
    const log = createLogger();
    log.info("default-info");
    expect(console.info).toHaveBeenCalledOnce();
  });

  it("prefers globalThis value over process.env", () => {
    (globalThis as { ACARS_LOG_LEVEL?: string }).ACARS_LOG_LEVEL = "error";
    const prev = process.env.ACARS_LOG_LEVEL;
    process.env.ACARS_LOG_LEVEL = "debug";
    try {
      const log = createLogger();
      log.warn("suppressed-by-global-error");
      expect(console.warn).not.toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete process.env.ACARS_LOG_LEVEL;
      else process.env.ACARS_LOG_LEVEL = prev;
    }
  });
});
