import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureConfigDir, getConfigDir, getDbPath, loadConfig, saveConfig } from "@/config.ts";

const TEST_DIR = join(tmpdir(), `clokk-test-${Date.now()}`);

function setTestDir(dir: string) {
  process.env.CLOKK_DIR = dir;
}

afterEach(() => {
  delete process.env.CLOKK_DIR;
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
});

describe("getConfigDir", () => {
  it("respects CLOKK_DIR environment variable", () => {
    setTestDir("/tmp/custom-clokk");
    expect(getConfigDir()).toBe("/tmp/custom-clokk");
  });

  it("defaults to ~/.clokk", () => {
    delete process.env.CLOKK_DIR;
    const dir = getConfigDir();
    expect(dir).toEndWith(".clokk");
  });
});

describe("getDbPath", () => {
  it("returns clokk.db inside config dir", () => {
    setTestDir("/tmp/test-clokk");
    expect(getDbPath()).toBe("/tmp/test-clokk/clokk.db");
  });
});

describe("ensureConfigDir", () => {
  it("creates directory and default config.json", () => {
    setTestDir(TEST_DIR);
    ensureConfigDir();

    expect(existsSync(TEST_DIR)).toBe(true);
    expect(existsSync(join(TEST_DIR, "config.json"))).toBe(true);
  });

  it("does not overwrite existing config", () => {
    setTestDir(TEST_DIR);
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, "config.json"), JSON.stringify({ default_currency: "EUR" }));

    ensureConfigDir();

    const config = loadConfig();
    expect(config.default_currency).toBe("EUR");
  });
});

describe("loadConfig", () => {
  it("returns defaults when no config file exists", () => {
    setTestDir(join(TEST_DIR, "nonexistent"));
    const config = loadConfig();
    expect(config.default_billable).toBe(true);
    expect(config.default_currency).toBe("USD");
    expect(config.week_start).toBe("monday");
    expect(config.turso.url).toBeNull();
  });

  it("merges partial config with defaults", () => {
    setTestDir(TEST_DIR);
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      join(TEST_DIR, "config.json"),
      JSON.stringify({ default_currency: "EUR", week_start: "sunday" }),
    );

    const config = loadConfig();
    expect(config.default_currency).toBe("EUR");
    expect(config.week_start).toBe("sunday");
    // Defaults preserved for unset keys
    expect(config.default_billable).toBe(true);
    expect(config.date_format).toBe("iso");
  });

  it("handles malformed JSON gracefully", () => {
    setTestDir(TEST_DIR);
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, "config.json"), "not json at all");

    const config = loadConfig();
    expect(config.default_currency).toBe("USD"); // falls back to defaults
  });
});

describe("saveConfig", () => {
  it("writes config to disk", () => {
    setTestDir(TEST_DIR);
    mkdirSync(TEST_DIR, { recursive: true });

    const config = loadConfig();
    config.default_currency = "GBP";
    saveConfig(config);

    const reloaded = loadConfig();
    expect(reloaded.default_currency).toBe("GBP");
  });
});
