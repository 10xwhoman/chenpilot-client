import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// #133 — logger stays silent in production, rate-limited in dev
describe("logger", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("is silent in production", async () => {
    process.env.NODE_ENV = "production";
    // Re-import after env change
    vi.resetModules();
    const { logger } = await import("../logger");
    logger.info("hello");
    logger.debug("world");
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("routes error calls through console.error even in production", async () => {
    process.env.NODE_ENV = "production";
    vi.resetModules();
    const { logger } = await import("../logger");
    logger.error("boom");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("writes debug logs in development", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();
    const { logger } = await import("../logger");
    logger.debug("dev msg");
    expect(logSpy).toHaveBeenCalled();
  });

  it("rate-limits identical messages in development", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();
    const { logger } = await import("../logger");
    logger.info("dup");
    logger.info("dup");
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
