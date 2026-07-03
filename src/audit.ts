/** Structured audit trail. One JSON line per security-relevant event, to stderr. */
import type { Caller } from "./entra.js";

export interface AuditEvent {
  action: string;
  outcome: "ok" | "denied" | "error";
  target?: string;
  detail?: string;
}

export function audit(caller: Pick<Caller, "oid" | "name">, event: AuditEvent): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    caller: caller.oid,
    callerName: caller.name,
    ...event,
  });
  // stderr so it never contaminates the MCP stdout/HTTP protocol stream.
  process.stderr.write(`${line}\n`);
}
