import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getContext } from "@/cli/context.ts";
import { registerEntryTools } from "@/mcp/tools/entries.ts";
import { registerProjectTools } from "@/mcp/tools/projects.ts";
import { registerReportTools } from "@/mcp/tools/reports.ts";
import { registerTimerTools } from "@/mcp/tools/timer.ts";

// Must stay in sync with package.json and src/cli/index.ts
const VERSION = "0.1.0";

export async function startMcpServer(): Promise<void> {
  const { repo } = await getContext();

  const server = new McpServer({
    name: "clokk",
    version: VERSION,
  });

  registerTimerTools(server, repo);
  registerEntryTools(server, repo);
  registerProjectTools(server, repo);
  registerReportTools(server, repo);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
