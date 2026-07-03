/**
 * Audit trail — emits the GB standard `gb.audit/v1` event (see
 * gb-studio/docs/audit-logging.md). One JSON line per security-relevant event, to
 * STDOUT (operational/debug logs go to stderr). The cluster log agent ships stdout
 * to Loki; this service holds no logging credentials and never rewrites past events.
 */
import type { Caller } from "./entra.js";

const SCHEMA = "gb.audit/v1";
const SERVICE = process.env.AUDIT_SERVICE ?? "domeneshop-mcp";
const ENV = process.env.AUDIT_ENV ?? process.env.NODE_ENV ?? "dev";
const TENANT = process.env.AUDIT_TENANT ?? "godtbrod";

export interface AuditEvent {
  action: string;
  outcome: "ok" | "denied" | "error";
  /** What was acted on — an id/name, NEVER a secret value or full PII. */
  resource?: string;
  /** Required for denied/error. */
  reason?: string;
  /** Correlates events within one operation. */
  traceId?: string;
}

export function audit(actor: Pick<Caller, "oid" | "upn" | "name">, event: AuditEvent): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    schema: SCHEMA,
    event_type: "audit",
    service: SERVICE,
    env: ENV,
    tenant: TENANT,
    actor: { oid: actor.oid, upn: actor.upn, name: actor.name },
    action: event.action,
    resource: event.resource,
    outcome: event.outcome,
    reason: event.reason,
    trace_id: event.traceId,
  });
  process.stdout.write(`${line}\n`);
}
