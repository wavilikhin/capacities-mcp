import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CapacitiesApiClient } from "./capacities-client.js";
import { loadCapacitiesConfig } from "./config.js";
import { registerReadQueryTools } from "./read-query-tools.js";

async function main(): Promise<void> {
  const env =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const config = loadCapacitiesConfig(env);
  const client = new CapacitiesApiClient(config);

  const server = new McpServer({
    name: "mcp-capacities-server",
    version: "0.1.0"
  });

  registerReadQueryTools(server, { client, config });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error.";
  console.error(`Failed to start mcp-capacities-server: ${message}`);
});
