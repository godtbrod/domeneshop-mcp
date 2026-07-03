/**
 * Live, READ-ONLY integration test against the real Domeneshop API.
 * Skips unless DOMENESHOP_TOKEN/SECRET are present (supplied by dotenvx).
 * Run: pnpm test:live   (which is `dotenvx run -- vitest run <this>`)
 *
 * It only LISTS domains + reads DNS — it never creates/updates/deletes a record,
 * so it cannot change your production DNS. It prints domain names and record
 * counts only — never the credentials.
 */
import { describe, it, expect } from "vitest";
import { Domeneshop } from "../src/domeneshop.js";

const token = process.env.DOMENESHOP_TOKEN;
const secret = process.env.DOMENESHOP_SECRET;
const RUN = Boolean(token && secret);

describe.skipIf(!RUN)("Domeneshop live (read-only)", () => {
  const api = new Domeneshop(token ?? "", secret ?? "");

  it("authenticates and lists domains on the account", async () => {
    const domains = await api.listDomains();
    expect(Array.isArray(domains)).toBe(true);
    // eslint-disable-next-line no-console
    console.log(`✓ ${domains.length} domain(s):`, domains.map((d) => d.domain).join(", "));
    expect(domains.length).toBeGreaterThan(0);
  });

  it("resolves godtbrod.no and reads its DNS records", async () => {
    const id = await api.domainIdByName("godtbrod.no");
    const records = await api.listDns(id);
    // eslint-disable-next-line no-console
    console.log(`✓ godtbrod.no (id ${id}) has ${records.length} DNS record(s)`);
    const types = [...new Set(records.map((r) => r.type))].sort().join(", ");
    // eslint-disable-next-line no-console
    console.log(`  record types present: ${types}`);
    expect(records.length).toBeGreaterThan(0);
  });
});
