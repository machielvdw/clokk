import { beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { SqliteRepository } from "@/data/sqlite.ts";
import * as schema from "@/data/schema.ts";
import type { Repository } from "@/data/repository.ts";
import { generateReport, exportEntries } from "@/core/reports.ts";

let repo: Repository;

function createRepo(): Repository {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return new SqliteRepository(sqlite);
}

async function seedData() {
  await repo.createProject({
    id: "prj_acme",
    name: "Acme",
    rate: 150,
    currency: "USD",
  });
  await repo.createProject({
    id: "prj_beta",
    name: "Beta",
    rate: 100,
    currency: "EUR",
  });

  // Monday entries
  await repo.createEntry({
    id: "ent_1",
    project_id: "prj_acme",
    description: "Backend API",
    start_time: "2026-02-23T09:00:00.000Z", // Monday
    end_time: "2026-02-23T12:00:00.000Z",
    tags: ["backend", "api"],
    billable: true,
  });
  await repo.createEntry({
    id: "ent_2",
    project_id: "prj_acme",
    description: "Frontend",
    start_time: "2026-02-23T13:00:00.000Z", // Monday
    end_time: "2026-02-23T15:00:00.000Z",
    tags: ["frontend"],
    billable: true,
  });
  // Tuesday entry
  await repo.createEntry({
    id: "ent_3",
    project_id: "prj_beta",
    description: "Design review",
    start_time: "2026-02-24T10:00:00.000Z", // Tuesday
    end_time: "2026-02-24T11:30:00.000Z",
    tags: ["design", "frontend"],
    billable: false,
  });
  // No project entry
  await repo.createEntry({
    id: "ent_4",
    description: "Internal meeting",
    start_time: "2026-02-24T14:00:00.000Z", // Tuesday
    end_time: "2026-02-24T15:00:00.000Z",
    tags: [],
    billable: false,
  });
}

beforeEach(() => {
  repo = createRepo();
});

// ─── generateReport ─────────────────────────────────────────────

describe("generateReport", () => {
  it("groups by project (default)", async () => {
    await seedData();
    const report = await generateReport(repo, {});

    expect(report.total_seconds).toBe(3600 * 3 + 3600 * 2 + 5400 + 3600); // 10h total = 36000
    expect(report.groups.length).toBe(3); // Acme, Beta, No Project

    const acme = report.groups.find((g) => g.key === "Acme")!;
    expect(acme.total_seconds).toBe(3600 * 5); // 5 hours
    expect(acme.billable_seconds).toBe(3600 * 5);
    expect(acme.entry_count).toBe(2);

    const beta = report.groups.find((g) => g.key === "Beta")!;
    expect(beta.total_seconds).toBe(5400); // 1.5 hours
    expect(beta.billable_seconds).toBe(0);
    expect(beta.entry_count).toBe(1);

    const noProject = report.groups.find((g) => g.key === "No Project")!;
    expect(noProject.total_seconds).toBe(3600);
    expect(noProject.entry_count).toBe(1);
  });

  it("computes billable amounts from project rates", async () => {
    await seedData();
    const report = await generateReport(repo, {});

    const acme = report.groups.find((g) => g.key === "Acme")!;
    // 5 hours * $150/hr = $750
    expect(acme.billable_amount).toBe(750);
    expect(acme.currency).toBe("USD");

    const beta = report.groups.find((g) => g.key === "Beta")!;
    // 0 billable seconds, so rate * 0 = $0
    expect(beta.billable_amount).toBe(0);
    expect(beta.currency).toBe("EUR");
  });

  it("groups by tag", async () => {
    await seedData();
    const report = await generateReport(repo, { group_by: "tag" });

    // backend, api, frontend, design, untagged
    expect(report.groups.length).toBe(5);

    const frontend = report.groups.find((g) => g.key === "frontend")!;
    // ent_2 (2h) + ent_3 (1.5h) = 3.5h = 12600s
    expect(frontend.total_seconds).toBe(12600);
    expect(frontend.entry_count).toBe(2);

    const untagged = report.groups.find((g) => g.key === "untagged")!;
    expect(untagged.entry_count).toBe(1);
  });

  it("groups by day", async () => {
    await seedData();
    const report = await generateReport(repo, { group_by: "day" });

    expect(report.groups.length).toBe(2); // Monday and Tuesday

    const monday = report.groups.find((g) => g.key === "2026-02-23")!;
    expect(monday.entry_count).toBe(2);
    expect(monday.total_seconds).toBe(3600 * 5); // 5 hours

    const tuesday = report.groups.find((g) => g.key === "2026-02-24")!;
    expect(tuesday.entry_count).toBe(2);
    expect(tuesday.total_seconds).toBe(5400 + 3600); // 2.5 hours
  });

  it("groups by week", async () => {
    await seedData();
    const report = await generateReport(repo, { group_by: "week" });

    // All entries are in the same week (week of 2026-02-23, Monday)
    expect(report.groups.length).toBe(1);
    expect(report.groups[0]!.key).toBe("Week of 2026-02-23");
    expect(report.groups[0]!.entry_count).toBe(4);
  });

  it("filters by project", async () => {
    await seedData();
    const report = await generateReport(repo, { project_id: "prj_acme" });
    expect(report.groups.length).toBe(1);
    expect(report.groups[0]!.key).toBe("Acme");
    expect(report.groups[0]!.entry_count).toBe(2);
  });

  it("filters by date range", async () => {
    await seedData();
    const report = await generateReport(repo, {
      from: "2026-02-24T00:00:00.000Z",
      to: "2026-02-24T23:59:59.999Z",
    });
    // Only Tuesday entries
    expect(report.total_seconds).toBe(5400 + 3600);
  });

  it("handles empty results", async () => {
    const report = await generateReport(repo, {});
    expect(report.total_seconds).toBe(0);
    expect(report.billable_seconds).toBe(0);
    expect(report.groups).toHaveLength(0);
  });
});

// ─── exportEntries ──────────────────────────────────────────────

describe("exportEntries", () => {
  it("exports as CSV with correct headers", async () => {
    await seedData();
    const result = await exportEntries(repo, { format: "csv" });

    expect(result.format).toBe("csv");
    expect(result.entry_count).toBe(4);

    const lines = result.data.split("\n");
    expect(lines[0]).toBe(
      "id,description,project,start_time,end_time,duration_seconds,tags,billable",
    );
    expect(lines.length).toBe(5); // header + 4 entries
  });

  it("resolves project names in CSV", async () => {
    await seedData();
    const result = await exportEntries(repo, { format: "csv" });
    const lines = result.data.split("\n");
    // First data row should have "Acme" as project
    expect(lines[1]).toContain("Acme");
  });

  it("escapes CSV fields with commas and quotes", async () => {
    await repo.createEntry({
      id: "ent_csv",
      description: 'Bug fix, "critical"',
      start_time: "2026-02-26T09:00:00.000Z",
      end_time: "2026-02-26T10:00:00.000Z",
    });
    const result = await exportEntries(repo, { format: "csv" });
    const lines = result.data.split("\n");
    // Should be properly escaped
    expect(lines[1]).toContain('"Bug fix, ""critical"""');
  });

  it("exports as JSON", async () => {
    await seedData();
    const result = await exportEntries(repo, { format: "json" });

    expect(result.format).toBe("json");
    expect(result.entry_count).toBe(4);

    const parsed = JSON.parse(result.data);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(4);
    expect(parsed[0].id).toBe("ent_1");
    expect(parsed[0].project).toBe("Acme");
  });

  it("defaults to CSV format", async () => {
    await seedData();
    const result = await exportEntries(repo, {});
    expect(result.format).toBe("csv");
  });

  it("filters by project", async () => {
    await seedData();
    const result = await exportEntries(repo, {
      project_id: "prj_beta",
      format: "json",
    });
    const parsed = JSON.parse(result.data);
    expect(parsed.length).toBe(1);
    expect(parsed[0].project).toBe("Beta");
  });

  it("handles empty export", async () => {
    const result = await exportEntries(repo, { format: "csv" });
    expect(result.entry_count).toBe(0);
    const lines = result.data.split("\n");
    expect(lines.length).toBe(1); // just header
  });
});
