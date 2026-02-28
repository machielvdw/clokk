import { describe, expect, it } from "bun:test";
import { getDefaultConfig } from "@/config.ts";
import { login, logout } from "@/core/auth.ts";
import { AuthError } from "@/core/errors.ts";

describe("login", () => {
  it("sets turso credentials in config", () => {
    const config = getDefaultConfig();
    const result = login(config, {
      url: "libsql://my-db.turso.io",
      token: "test-token-123",
    });
    expect(result.url).toBe("libsql://my-db.turso.io");
    expect(result.config.turso.url).toBe("libsql://my-db.turso.io");
    expect(result.config.turso.token).toBe("test-token-123");
  });

  it("accepts https:// URLs", () => {
    const config = getDefaultConfig();
    const result = login(config, {
      url: "https://my-db.turso.io",
      token: "tok",
    });
    expect(result.url).toBe("https://my-db.turso.io");
  });

  it("throws AuthError for empty url", () => {
    const config = getDefaultConfig();
    expect(() => login(config, { url: "", token: "tok" })).toThrow(AuthError);
  });

  it("throws AuthError for empty token", () => {
    const config = getDefaultConfig();
    expect(() => login(config, { url: "libsql://db.turso.io", token: "" })).toThrow(AuthError);
  });

  it("throws AuthError for invalid URL scheme", () => {
    const config = getDefaultConfig();
    expect(() => login(config, { url: "ftp://bad.example", token: "tok" })).toThrow(AuthError);
  });

  it("error has AUTH_ERROR code", () => {
    const config = getDefaultConfig();
    try {
      login(config, { url: "", token: "tok" });
    } catch (err) {
      expect((err as AuthError).code).toBe("AUTH_ERROR");
    }
  });
});

describe("logout", () => {
  it("clears turso credentials", () => {
    const config = getDefaultConfig();
    config.turso.url = "libsql://my-db.turso.io";
    config.turso.token = "test-token";
    const result = logout(config);
    expect(result.was_configured).toBe(true);
    expect(result.config.turso.url).toBeNull();
    expect(result.config.turso.token).toBeNull();
  });

  it("returns was_configured=false when not configured", () => {
    const config = getDefaultConfig();
    const result = logout(config);
    expect(result.was_configured).toBe(false);
    expect(result.config.turso.url).toBeNull();
    expect(result.config.turso.token).toBeNull();
  });
});
