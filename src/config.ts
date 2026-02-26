import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ClokkConfig {
  default_project: string | null;
  default_billable: boolean;
  default_currency: string;
  week_start: string;
  date_format: string;
  turso: {
    url: string | null;
    token: string | null;
  };
}

const DEFAULT_CONFIG: ClokkConfig = {
  default_project: null,
  default_billable: true,
  default_currency: "USD",
  week_start: "monday",
  date_format: "iso",
  turso: {
    url: null,
    token: null,
  },
};

export function getConfigDir(): string {
  return process.env.CLOKK_DIR ?? join(homedir(), ".clokk");
}

export function getDbPath(): string {
  return join(getConfigDir(), "clokk.db");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

export function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
  }
}

export function loadConfig(): ClokkConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG, turso: { ...DEFAULT_CONFIG.turso } };
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ClokkConfig>;
    return mergeConfig(parsed);
  } catch {
    return { ...DEFAULT_CONFIG, turso: { ...DEFAULT_CONFIG.turso } };
  }
}

export function saveConfig(config: ClokkConfig): void {
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

function mergeConfig(partial: Partial<ClokkConfig>): ClokkConfig {
  return {
    default_project: partial.default_project ?? DEFAULT_CONFIG.default_project,
    default_billable: partial.default_billable ?? DEFAULT_CONFIG.default_billable,
    default_currency: partial.default_currency ?? DEFAULT_CONFIG.default_currency,
    week_start: partial.week_start ?? DEFAULT_CONFIG.week_start,
    date_format: partial.date_format ?? DEFAULT_CONFIG.date_format,
    turso: {
      url: partial.turso?.url ?? DEFAULT_CONFIG.turso.url,
      token: partial.turso?.token ?? DEFAULT_CONFIG.turso.token,
    },
  };
}

export function getDefaultConfig(): ClokkConfig {
  return { ...DEFAULT_CONFIG, turso: { ...DEFAULT_CONFIG.turso } };
}
