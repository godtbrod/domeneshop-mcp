import { describe, it, expect, vi, afterEach } from "vitest";
import { audit } from "../src/audit.js";

function captureStdout(): string[] {
  const writes: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => {
    writes.push(String(chunk));
    return true;
  }) as typeof process.stdout.write);
  return writes;
}

describe("audit gb.audit/v1", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits one conforming JSON line to stdout", () => {
    const writes = captureStdout();
    audit(
      { oid: "u1", upn: "morten@godtbrod.no", name: "Morten" },
      { action: "create_dns_record", resource: "app.example.no A", outcome: "denied", reason: "not allowed", traceId: "t1" },
    );
    expect(writes).toHaveLength(1);
    const line = writes[0] ?? "";
    expect(line.endsWith("\n")).toBe(true);
    const e = JSON.parse(line) as Record<string, unknown>;
    expect(e.schema).toBe("gb.audit/v1");
    expect(e.event_type).toBe("audit");
    expect(e.service).toBe("domeneshop-mcp");
    expect(e.tenant).toBe("godtbrod");
    expect((e.actor as Record<string, unknown>).oid).toBe("u1");
    expect((e.actor as Record<string, unknown>).upn).toBe("morten@godtbrod.no");
    expect(e.action).toBe("create_dns_record");
    expect(e.resource).toBe("app.example.no A");
    expect(e.outcome).toBe("denied");
    expect(e.reason).toBe("not allowed");
    expect(e.trace_id).toBe("t1");
    expect(typeof e.ts).toBe("string");
  });

  it("never carries group membership (type-enforced) in the actor", () => {
    const writes = captureStdout();
    audit({ oid: "u1", upn: "x", name: "n" }, { action: "list_domains", outcome: "ok" });
    const e = JSON.parse(writes[0] ?? "") as { actor: Record<string, unknown> };
    expect(e.actor.groups).toBeUndefined();
  });
});
