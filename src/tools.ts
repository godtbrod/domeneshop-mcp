/** MCP tools for DNS pointer management. Every mutation is allowlist-gated and audited. */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./config.js";
import type { Caller } from "./entra.js";
import { AccessError, assertDomainMutable } from "./authz.js";
import { audit } from "./audit.js";
import { Domeneshop, DomeneshopError, type DnsRecordInput } from "./domeneshop.js";

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

function text(body: string, isError = false): ToolResult {
  return { content: [{ type: "text", text: body }], isError };
}

const recordShape = {
  domain: z.string().describe("The apex domain, e.g. example.no"),
  host: z.string().describe('Subdomain/host, e.g. "app" or "@" for the apex'),
  type: z.enum(["A", "AAAA", "CNAME", "TXT", "MX", "SRV", "NS", "CAA"]),
  data: z.string().describe("Record value, e.g. an IP or target hostname"),
  ttl: z.number().int().optional(),
};

export function registerTools(server: McpServer, caller: Caller, config: Config): void {
  const api = new Domeneshop(config.domeneshop.token, config.domeneshop.secret);

  const run = async (action: string, target: string, fn: () => Promise<ToolResult>): Promise<ToolResult> => {
    try {
      const result = await fn();
      audit(caller, { action, target, outcome: "ok" });
      return result;
    } catch (err) {
      if (err instanceof AccessError) {
        audit(caller, { action, target, outcome: "denied", detail: err.message });
        return text(err.message, true);
      }
      const detail = err instanceof DomeneshopError ? err.message : String(err);
      audit(caller, { action, target, outcome: "error", detail });
      return text(`Noe gikk galt: ${detail}`, true);
    }
  };

  server.registerTool(
    "list_domains",
    { description: "List the domains available on the Domeneshop account.", inputSchema: {} },
    () =>
      run("list_domains", "*", async () => {
        const domains = await api.listDomains();
        return text(domains.map((d) => `- ${d.domain} (id ${d.id})`).join("\n") || "Ingen domener.");
      }),
  );

  server.registerTool(
    "list_dns_records",
    { description: "List DNS records for a domain.", inputSchema: { domain: z.string() } },
    ({ domain }) =>
      run("list_dns_records", domain, async () => {
        const id = await api.domainIdByName(domain);
        const records = await api.listDns(id);
        const rows = records.map(
          (r) => `#${r.id} ${r.host} ${r.type} → ${r.data}${r.ttl ? ` (ttl ${r.ttl})` : ""}`,
        );
        return text(rows.join("\n") || "Ingen DNS-oppføringer.");
      }),
  );

  server.registerTool(
    "create_dns_record",
    { description: "Create a DNS record (allowlisted domains only).", inputSchema: recordShape },
    ({ domain, host, type, data, ttl }) =>
      run("create_dns_record", `${host}.${domain} ${type}`, async () => {
        assertDomainMutable(domain, config.domainAllowlist);
        const id = await api.domainIdByName(domain);
        const record: DnsRecordInput = { host, type, data, ttl };
        await api.createDns(id, record);
        return text(`Opprettet ${type}-oppføring ${host}.${domain} → ${data}.`);
      }),
  );

  server.registerTool(
    "update_dns_record",
    {
      description: "Update an existing DNS record by id (allowlisted domains only).",
      inputSchema: { ...recordShape, recordId: z.number().int() },
    },
    ({ domain, recordId, host, type, data, ttl }) =>
      run("update_dns_record", `${host}.${domain} ${type} #${recordId}`, async () => {
        assertDomainMutable(domain, config.domainAllowlist);
        const id = await api.domainIdByName(domain);
        await api.updateDns(id, recordId, { host, type, data, ttl });
        return text(`Oppdaterte oppføring #${recordId} på ${domain}.`);
      }),
  );

  server.registerTool(
    "delete_dns_record",
    {
      description:
        "Delete a DNS record by id (allowlisted domains only). Destructive — confirm the record with list_dns_records first.",
      inputSchema: { domain: z.string(), recordId: z.number().int() },
    },
    ({ domain, recordId }) =>
      run("delete_dns_record", `${domain} #${recordId}`, async () => {
        assertDomainMutable(domain, config.domainAllowlist);
        const id = await api.domainIdByName(domain);
        await api.deleteDns(id, recordId);
        return text(`Slettet oppføring #${recordId} på ${domain}.`);
      }),
  );
}
