import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface VersionCache {
  checked_at: string;
  latest_version: string;
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_FILE = ".version-check.json";
const REGISTRY_URL = "https://registry.npmjs.org/clokk/latest";

function isNewer(latest: string, current: string): boolean {
  const [lMaj = 0, lMin = 0, lPat = 0] = latest.split(".").map(Number);
  const [cMaj = 0, cMin = 0, cPat = 0] = current.split(".").map(Number);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

function readCache(cachePath: string): VersionCache | null {
  if (!existsSync(cachePath)) return null;
  try {
    return JSON.parse(readFileSync(cachePath, "utf-8"));
  } catch {
    return null;
  }
}

function writeCache(cachePath: string, cache: VersionCache): void {
  writeFileSync(cachePath, JSON.stringify(cache), "utf-8");
}

function printHint(latest: string, current: string): void {
  console.error(
    `\nA new version of clokk is available: ${latest} (current: ${current}). Run "npm update -g clokk" to upgrade.`,
  );
}

export async function checkForUpdate(configDir: string, currentVersion: string): Promise<void> {
  try {
    const cachePath = join(configDir, CACHE_FILE);
    const cache = readCache(cachePath);

    if (cache) {
      const elapsed = Date.now() - new Date(cache.checked_at).getTime();
      if (elapsed < CHECK_INTERVAL_MS) {
        // Within interval — use cached version
        if (isNewer(cache.latest_version, currentVersion)) {
          printHint(cache.latest_version, currentVersion);
        }
        return;
      }
    }

    // Stale or no cache — fetch from registry
    const res = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return;

    const data = (await res.json()) as { version?: string };
    if (!data.version) return;

    writeCache(cachePath, {
      checked_at: new Date().toISOString(),
      latest_version: data.version,
    });

    if (isNewer(data.version, currentVersion)) {
      printHint(data.version, currentVersion);
    }
  } catch {
    // Silently ignore all errors — never block the user
  }
}
