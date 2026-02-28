import { describe, expect, it } from "bun:test";
import type { ClokkConfig } from "@/config.ts";
import { getDefaultConfig } from "@/config.ts";
import { getConfigValue, setConfigValue, showConfig } from "@/core/config.ts";
import { ConfigKeyUnknownError, ConfigValueInvalidError } from "@/core/errors.ts";

function freshConfig(): ClokkConfig {
  return getDefaultConfig();
}

// ─── showConfig ─────────────────────────────────────────────────

describe("showConfig", () => {
  it("returns the full config object", () => {
    const config = freshConfig();
    const result = showConfig(config);
    expect(result).toEqual(config);
  });
});

// ─── getConfigValue ─────────────────────────────────────────────

describe("getConfigValue", () => {
  it("gets a top-level key", () => {
    const config = freshConfig();
    const result = getConfigValue(config, "default_currency");
    expect(result.key).toBe("default_currency");
    expect(result.value).toBe("USD");
  });

  it("gets a boolean key", () => {
    const config = freshConfig();
    const result = getConfigValue(config, "default_billable");
    expect(result.value).toBe(true);
  });

  it("gets a nullable key", () => {
    const config = freshConfig();
    const result = getConfigValue(config, "default_project");
    expect(result.value).toBeNull();
  });

  it("gets a nested key with dot notation", () => {
    const config = freshConfig();
    const result = getConfigValue(config, "turso.url");
    expect(result.key).toBe("turso.url");
    expect(result.value).toBeNull();
  });

  it("throws ConfigKeyUnknownError for unknown key", () => {
    const config = freshConfig();
    expect(() => getConfigValue(config, "nonexistent")).toThrow(ConfigKeyUnknownError);
  });

  it("throws ConfigKeyUnknownError for partial dot path", () => {
    const config = freshConfig();
    expect(() => getConfigValue(config, "turso")).toThrow(ConfigKeyUnknownError);
  });
});

// ─── setConfigValue ─────────────────────────────────────────────

describe("setConfigValue", () => {
  it("sets a string value", () => {
    const config = freshConfig();
    const result = setConfigValue(config, "default_currency", "EUR");
    expect(result.key).toBe("default_currency");
    expect(result.value).toBe("EUR");
    expect(result.config.default_currency).toBe("EUR");
  });

  it("sets a boolean value", () => {
    const config = freshConfig();
    const result = setConfigValue(config, "default_billable", false);
    expect(result.config.default_billable).toBe(false);
  });

  it("sets a nullable value to null", () => {
    const config = freshConfig();
    config.default_project = "old-project";
    const result = setConfigValue(config, "default_project", null);
    expect(result.config.default_project).toBeNull();
  });

  it("sets a nested value with dot notation", () => {
    const config = freshConfig();
    const result = setConfigValue(config, "turso.url", "libsql://my-db.turso.io");
    expect(result.config.turso.url).toBe("libsql://my-db.turso.io");
  });

  it("validates week_start against valid weekdays", () => {
    const config = freshConfig();
    const result = setConfigValue(config, "week_start", "sunday");
    expect(result.config.week_start).toBe("sunday");
  });

  it("throws ConfigKeyUnknownError for unknown key", () => {
    const config = freshConfig();
    expect(() => setConfigValue(config, "nonexistent", "value")).toThrow(ConfigKeyUnknownError);
  });

  it("throws ConfigValueInvalidError for wrong type", () => {
    const config = freshConfig();
    expect(() => setConfigValue(config, "default_billable", "yes")).toThrow(
      ConfigValueInvalidError,
    );
  });

  it("throws ConfigValueInvalidError for invalid week_start", () => {
    const config = freshConfig();
    expect(() => setConfigValue(config, "week_start", "someday")).toThrow(ConfigValueInvalidError);
  });

  it("throws ConfigValueInvalidError for number instead of string", () => {
    const config = freshConfig();
    expect(() => setConfigValue(config, "default_currency", 123)).toThrow(ConfigValueInvalidError);
  });
});
