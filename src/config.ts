/** Runtime config, sourced entirely from env. Secrets never come through chat/tool args. */

export interface Config {
  port: number;
  bind: string;
  publicUrl: string;
  entra: {
    tenantId: string;
    issuer: string;
    /** Primary audience (app id URI) — used in the resource-metadata document. */
    audience: string;
    /** Accepted token audiences (app id URI and bare appId). */
    audiences: string[];
    requiredGroupId: string;
    jwksUri: string;
  };
  domeneshop: { token: string; secret: string };
  /** Apex domains that may be mutated. Empty => mutations denied (reads still allowed). */
  domainAllowlist: string[];
}

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v.trim() === "") {
    throw new Error(`Missing required env var ${name}`);
  }
  return v.trim();
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function loadConfig(): Config {
  const tenantId = required("ENTRA_TENANT_ID");
  const audience = required("ENTRA_AUDIENCE");
  const audiences = [audience];
  const bare = audience.replace(/^api:\/\//, "");
  if (bare !== audience) audiences.push(bare);
  return {
    port: Number(process.env.PORT ?? "3900"),
    bind: process.env.BIND ?? "0.0.0.0",
    publicUrl: process.env.PUBLIC_URL ?? "",
    entra: {
      tenantId,
      issuer: process.env.ENTRA_ISSUER ?? `https://login.microsoftonline.com/${tenantId}/v2.0`,
      audience,
      audiences,
      requiredGroupId: required("REQUIRED_GROUP_ID"),
      jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    },
    domeneshop: { token: required("DOMENESHOP_TOKEN"), secret: required("DOMENESHOP_SECRET") },
    domainAllowlist: list("DOMAIN_ALLOWLIST"),
  };
}
