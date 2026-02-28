import type { ClokkConfig } from "@/config.ts";
import { ConfigKeyUnknownError, ConfigValueInvalidError } from "@/core/errors.ts";

const VALID_KEYS: Record<
  string,
  { type: string; path: string[]; validate?: (v: unknown) => boolean }
> = {
  default_project: { type: "string | null", path: ["default_project"] },
  default_billable: { type: "boolean", path: ["default_billable"] },
  default_currency: { type: "string", path: ["default_currency"] },
  week_start: {
    type: "string",
    path: ["week_start"],
    validate: (v) =>
      typeof v === "string" &&
      ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].includes(
        v.toLowerCase(),
      ),
  },
  date_format: { type: "string", path: ["date_format"] },
  "turso.url": { type: "string | null", path: ["turso", "url"] },
  "turso.token": { type: "string | null", path: ["turso", "token"] },
};

export function showConfig(config: ClokkConfig): ClokkConfig {
  return config;
}

export function getConfigValue(config: ClokkConfig, key: string): { key: string; value: unknown } {
  const keyDef = VALID_KEYS[key];
  if (!keyDef) throw new ConfigKeyUnknownError(key);

  const value = getNestedValue(config, keyDef.path);
  return { key, value };
}

export function setConfigValue(
  config: ClokkConfig,
  key: string,
  value: unknown,
): { key: string; value: unknown; config: ClokkConfig } {
  const keyDef = VALID_KEYS[key];
  if (!keyDef) throw new ConfigKeyUnknownError(key);

  // Validate type
  if (!isValidType(value, keyDef.type)) {
    throw new ConfigValueInvalidError(key, value, keyDef.type);
  }

  // Run custom validation if present
  if (keyDef.validate && !keyDef.validate(value)) {
    throw new ConfigValueInvalidError(key, value, keyDef.type);
  }

  setNestedValue(config, keyDef.path, value);
  return { key, value, config };
}

function getNestedValue(obj: ClokkConfig, path: string[]): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function setNestedValue(obj: ClokkConfig, path: string[], value: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = obj;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]!];
  }
  current[path[path.length - 1]!] = value;
}

function isValidType(value: unknown, expectedType: string): boolean {
  if (expectedType === "string | null") {
    return typeof value === "string" || value === null;
  }
  if (expectedType === "boolean") {
    return typeof value === "boolean";
  }
  if (expectedType === "string") {
    return typeof value === "string";
  }
  return false;
}
