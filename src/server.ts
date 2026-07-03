import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./config.js";
import type { Caller } from "./entra.js";
import { registerTools } from "./tools.js";

/** Build a fresh MCP server bound to one authenticated caller. */
export function buildServer(caller: Caller, config: Config): McpServer {
  const server = new McpServer(
    { name: "godtbrod-domeneshop-mcp", version: "0.1.0" },
    {
      instructions:
        "Manage Domeneshop DNS records for Godt Brød apps. You are authenticated with your " +
        "Godt Brød (Entra) account; the Domeneshop credential is held server-side and never " +
        "exposed. Only allowlisted domains can be changed. Confirm records with " +
        "list_dns_records before deleting.",
    },
  );
  registerTools(server, caller, config);
  return server;
}
