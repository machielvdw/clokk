import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "mcp",
    description: "MCP server for AI agent integration",
  },
  args: {},
  subCommands: {
    serve: defineCommand({
      meta: {
        name: "serve",
        description: "Start the MCP server (stdio transport)",
      },
      args: {},
      async run() {
        // Dynamic path prevents bun build --compile from statically analyzing
        // the MCP module tree (which requires @modelcontextprotocol/sdk at runtime).
        const modulePath = "@/mcp/server.ts";
        const { startMcpServer } = await import(modulePath);
        await startMcpServer();
      },
    }),
  },
});
