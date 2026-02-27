import type { ClokkConfig } from "@/config.ts";
import { AuthError } from "@/core/errors.ts";

export interface LoginInput {
  url: string;
  token: string;
}

export interface LoginResult {
  url: string;
  config: ClokkConfig;
}

export interface LogoutResult {
  was_configured: boolean;
  config: ClokkConfig;
}

export function login(config: ClokkConfig, input: LoginInput): LoginResult {
  if (!input.url || !input.token) {
    throw new AuthError("Both Turso URL and token are required.");
  }

  if (!input.url.startsWith("libsql://") && !input.url.startsWith("https://")) {
    throw new AuthError(
      `Invalid Turso URL: "${input.url}". Expected a URL starting with libsql:// or https://.`,
    );
  }

  config.turso.url = input.url;
  config.turso.token = input.token;

  return { url: input.url, config };
}

export function logout(config: ClokkConfig): LogoutResult {
  const wasConfigure = config.turso.url !== null;
  config.turso.url = null;
  config.turso.token = null;
  return { was_configured: wasConfigure, config };
}
