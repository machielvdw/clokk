import type { Repository } from "@/data/repository.ts";
import type { ClokkConfig } from "@/config.ts";
import { ensureConfigDir, loadConfig } from "@/config.ts";
import { createRepository } from "@/data/factory.ts";

export interface ClokkContext {
  repo: Repository;
  config: ClokkConfig;
}

let cached: ClokkContext | null = null;

/**
 * Initialize and return the application context.
 * Creates config dir, loads config, and opens the database on first call.
 * Subsequent calls return the cached context.
 */
export function getContext(): ClokkContext {
  if (cached) return cached;
  ensureConfigDir();
  const config = loadConfig();
  const repo = createRepository(config);
  cached = { repo, config };
  return cached;
}

/**
 * Reset the cached context. Used in tests.
 */
export function resetContext(): void {
  cached = null;
}
