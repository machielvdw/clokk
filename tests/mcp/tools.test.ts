import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { logEntry } from "@/core/entries.ts";
import { createProject } from "@/core/projects.ts";
import type { Repository } from "@/data/repository.ts";
import * as schema from "@/data/schema.ts";
import { SqliteRepository } from "@/data/sqlite.ts";
import { registerEntryTools } from "@/mcp/tools/entries.ts";
import { registerProjectTools } from "@/mcp/tools/projects.ts";
import { registerReportTools } from "@/mcp/tools/reports.ts";
import { registerTimerTools } from "@/mcp/tools/timer.ts";

function createRepo(): Repository {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return new SqliteRepository(sqlite);
}

async function createServerAndClient(repo: Repository) {
  const server = new McpServer({ name: "clokk-test", version: "0.0.1" });
  registerTimerTools(server, repo);
  registerEntryTools(server, repo);
  registerProjectTools(server, repo);
  registerReportTools(server, repo);

  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { server, client, serverTransport, clientTransport };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResult(result: any) {
  return JSON.parse(result.content[0].text);
}

describe("tool registration", () => {
  it("registers all 15 tools without error", async () => {
    const repo = createRepo();
    const { client } = await createServerAndClient(repo);
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(15);
    await client.close();
  });

  it("has correct tool names", async () => {
    const repo = createRepo();
    const { client } = await createServerAndClient(repo);
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "cancel_timer",
      "create_project",
      "delete_entry",
      "edit_entry",
      "edit_project",
      "export_entries",
      "generate_report",
      "list_entries",
      "list_projects",
      "log_entry",
      "resume_timer",
      "start_timer",
      "stop_timer",
      "switch_timer",
      "timer_status",
    ]);
    await client.close();
  });
});

describe("timer tools", () => {
  let repo: Repository;
  let client: Client;

  beforeEach(async () => {
    repo = createRepo();
    const setup = await createServerAndClient(repo);
    client = setup.client;
  });

  afterEach(async () => {
    await client.close();
  });

  it("start_timer creates a running entry", async () => {
    const result = await client.callTool({
      name: "start_timer",
      arguments: { description: "Working on MCP" },
    });
    expect(result.isError).toBeFalsy();
    const data = parseResult(result);
    expect(data.id).toMatch(/^ent_/);
    expect(data.description).toBe("Working on MCP");
    expect(data.end_time).toBeNull();
  });

  it("start_timer fails when timer already running", async () => {
    await client.callTool({
      name: "start_timer",
      arguments: { description: "First" },
    });
    const result = await client.callTool({
      name: "start_timer",
      arguments: { description: "Second" },
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.error).toBe("TIMER_ALREADY_RUNNING");
  });

  it("timer_status shows running timer", async () => {
    await client.callTool({
      name: "start_timer",
      arguments: { description: "Status test" },
    });
    const result = await client.callTool({
      name: "timer_status",
      arguments: {},
    });
    const data = parseResult(result);
    expect(data.running).toBe(true);
    expect(data.entry.description).toBe("Status test");
    expect(data.elapsed_seconds).toBeGreaterThanOrEqual(0);
  });

  it("timer_status shows no timer", async () => {
    const result = await client.callTool({
      name: "timer_status",
      arguments: {},
    });
    const data = parseResult(result);
    expect(data.running).toBe(false);
  });

  it("stop_timer stops the running timer", async () => {
    await client.callTool({
      name: "start_timer",
      arguments: { description: "To stop" },
    });
    const result = await client.callTool({
      name: "stop_timer",
      arguments: {},
    });
    const data = parseResult(result);
    expect(data.end_time).not.toBeNull();
    expect(data.duration_seconds).toBeGreaterThanOrEqual(0);
  });

  it("switch_timer atomically stops and starts", async () => {
    await client.callTool({
      name: "start_timer",
      arguments: { description: "First task" },
    });
    const result = await client.callTool({
      name: "switch_timer",
      arguments: { description: "Second task" },
    });
    const data = parseResult(result);
    expect(data.stopped.description).toBe("First task");
    expect(data.stopped.end_time).not.toBeNull();
    expect(data.started.description).toBe("Second task");
    expect(data.started.end_time).toBeNull();
  });

  it("resume_timer clones the last entry", async () => {
    await client.callTool({
      name: "start_timer",
      arguments: { description: "Resume me", tags: ["backend"] },
    });
    await client.callTool({ name: "stop_timer", arguments: {} });
    const result = await client.callTool({
      name: "resume_timer",
      arguments: {},
    });
    const data = parseResult(result);
    expect(data.description).toBe("Resume me");
    expect(data.tags).toEqual(["backend"]);
    expect(data.end_time).toBeNull();
  });

  it("cancel_timer discards the running timer", async () => {
    await client.callTool({
      name: "start_timer",
      arguments: { description: "Cancel me" },
    });
    const result = await client.callTool({
      name: "cancel_timer",
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    // Verify timer is gone
    const status = await client.callTool({
      name: "timer_status",
      arguments: {},
    });
    expect(parseResult(status).running).toBe(false);
  });
});

describe("project tools", () => {
  let repo: Repository;
  let client: Client;

  beforeEach(async () => {
    repo = createRepo();
    const setup = await createServerAndClient(repo);
    client = setup.client;
  });

  afterEach(async () => {
    await client.close();
  });

  it("create_project and list_projects", async () => {
    // Initially empty
    const emptyResult = await client.callTool({
      name: "list_projects",
      arguments: {},
    });
    expect(parseResult(emptyResult)).toEqual([]);

    // Create
    const createResult = await client.callTool({
      name: "create_project",
      arguments: { name: "acme", client: "Acme Corp", rate: 150 },
    });
    const project = parseResult(createResult);
    expect(project.id).toMatch(/^prj_/);
    expect(project.name).toBe("acme");
    expect(project.client).toBe("Acme Corp");
    expect(project.rate).toBe(150);

    // List again
    const listResult = await client.callTool({
      name: "list_projects",
      arguments: {},
    });
    const projects = parseResult(listResult);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("acme");
  });

  it("create_project fails on duplicate name", async () => {
    await client.callTool({
      name: "create_project",
      arguments: { name: "acme" },
    });
    const result = await client.callTool({
      name: "create_project",
      arguments: { name: "acme" },
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result).error).toBe("PROJECT_ALREADY_EXISTS");
  });

  it("edit_project updates properties", async () => {
    await client.callTool({
      name: "create_project",
      arguments: { name: "acme" },
    });
    const result = await client.callTool({
      name: "edit_project",
      arguments: { id: "acme", client: "New Client" },
    });
    expect(parseResult(result).client).toBe("New Client");
  });
});

describe("entry tools", () => {
  let repo: Repository;
  let client: Client;

  beforeEach(async () => {
    repo = createRepo();
    const setup = await createServerAndClient(repo);
    client = setup.client;
  });

  afterEach(async () => {
    await client.close();
  });

  it("log_entry creates a completed entry", async () => {
    const result = await client.callTool({
      name: "log_entry",
      arguments: {
        description: "Meeting",
        from: "2026-02-28T09:00:00.000Z",
        to: "2026-02-28T10:00:00.000Z",
        tags: ["meeting"],
      },
    });
    const data = parseResult(result);
    expect(data.id).toMatch(/^ent_/);
    expect(data.description).toBe("Meeting");
    expect(data.duration_seconds).toBe(3600);
    expect(data.tags).toEqual(["meeting"]);
  });

  it("list_entries returns entries with filters", async () => {
    // Create a project and entries via core (to set up data)
    const project = await createProject(repo, { name: "acme" });
    await logEntry(repo, {
      description: "Task A",
      project: "acme",
      from: "2026-02-28T09:00:00.000Z",
      to: "2026-02-28T10:00:00.000Z",
    });
    await logEntry(repo, {
      description: "Task B",
      from: "2026-02-28T11:00:00.000Z",
      to: "2026-02-28T12:00:00.000Z",
    });

    // List all
    const allResult = await client.callTool({
      name: "list_entries",
      arguments: {},
    });
    expect(parseResult(allResult).entries).toHaveLength(2);

    // Filter by project name (tests resolveProjectId)
    const filteredResult = await client.callTool({
      name: "list_entries",
      arguments: { project: "acme" },
    });
    const filtered = parseResult(filteredResult);
    expect(filtered.entries).toHaveLength(1);
    expect(filtered.entries[0].description).toBe("Task A");
    expect(filtered.entries[0].project_id).toBe(project.id);
  });

  it("edit_entry modifies an entry", async () => {
    const entry = await logEntry(repo, {
      description: "Original",
      from: "2026-02-28T09:00:00.000Z",
      to: "2026-02-28T10:00:00.000Z",
    });
    const result = await client.callTool({
      name: "edit_entry",
      arguments: { id: entry.id, description: "Updated" },
    });
    expect(parseResult(result).description).toBe("Updated");
  });

  it("delete_entry removes an entry", async () => {
    const entry = await logEntry(repo, {
      description: "Delete me",
      from: "2026-02-28T09:00:00.000Z",
      to: "2026-02-28T10:00:00.000Z",
    });
    const result = await client.callTool({
      name: "delete_entry",
      arguments: { id: entry.id },
    });
    expect(result.isError).toBeFalsy();
    expect(parseResult(result).id).toBe(entry.id);
  });
});

describe("report tools", () => {
  let repo: Repository;
  let client: Client;

  beforeEach(async () => {
    repo = createRepo();
    const setup = await createServerAndClient(repo);
    client = setup.client;
  });

  afterEach(async () => {
    await client.close();
  });

  it("generate_report returns grouped data", async () => {
    await createProject(repo, { name: "acme" });
    await logEntry(repo, {
      description: "Work",
      project: "acme",
      from: "2026-02-28T09:00:00.000Z",
      to: "2026-02-28T11:00:00.000Z",
    });

    const result = await client.callTool({
      name: "generate_report",
      arguments: {
        from: "2026-02-28T00:00:00.000Z",
        to: "2026-02-28T23:59:59.000Z",
        group_by: "project",
      },
    });
    const data = parseResult(result);
    expect(data.total_seconds).toBe(7200);
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0].key).toBe("acme");
  });

  it("export_entries returns CSV data", async () => {
    await logEntry(repo, {
      description: "Export me",
      from: "2026-02-28T09:00:00.000Z",
      to: "2026-02-28T10:00:00.000Z",
    });

    const result = await client.callTool({
      name: "export_entries",
      arguments: { format: "csv" },
    });
    const data = parseResult(result);
    expect(data.format).toBe("csv");
    expect(data.entry_count).toBe(1);
    expect(data.data).toContain("Export me");
  });
});
