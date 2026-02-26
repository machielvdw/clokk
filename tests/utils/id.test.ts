import { describe, expect, it } from "bun:test";
import {
  generateEntryId,
  generateId,
  generateProjectId,
  isEntryId,
  isProjectId,
} from "@/utils/id.ts";

describe("generateId", () => {
  it("produces IDs with the given prefix", () => {
    const id = generateId("test");
    expect(id).toStartWith("test_");
  });

  it("produces IDs matching the base36 format", () => {
    const id = generateEntryId();
    expect(id).toMatch(/^ent_[a-z0-9]+$/);
  });

  it("produces unique IDs across 1000 calls", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateEntryId()));
    expect(ids.size).toBe(1000);
  });
});

describe("generateEntryId", () => {
  it("produces IDs with ent_ prefix", () => {
    expect(generateEntryId()).toStartWith("ent_");
  });
});

describe("generateProjectId", () => {
  it("produces IDs with prj_ prefix", () => {
    expect(generateProjectId()).toStartWith("prj_");
  });
});

describe("isEntryId", () => {
  it("returns true for entry IDs", () => {
    expect(isEntryId("ent_m3kf9xa8b2")).toBe(true);
  });

  it("returns false for non-entry IDs", () => {
    expect(isEntryId("prj_m3kf9x7c1d")).toBe(false);
    expect(isEntryId("acme")).toBe(false);
  });
});

describe("isProjectId", () => {
  it("returns true for project IDs", () => {
    expect(isProjectId("prj_m3kf9x7c1d")).toBe(true);
  });

  it("returns false for non-project IDs", () => {
    expect(isProjectId("ent_m3kf9xa8b2")).toBe(false);
    expect(isProjectId("acme")).toBe(false);
  });
});
