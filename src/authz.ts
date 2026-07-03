/** Authorization decisions, kept separate from authentication (entra.ts). */
import type { Caller } from "./entra.js";

/** Thrown when a valid caller is not permitted to do something (→ HTTP 403). */
export class AccessError extends Error {}

/** Gate: caller must belong to the studio access group. */
export function assertInGroup(caller: Caller, requiredGroupId: string): void {
  if (!caller.groups.includes(requiredGroupId)) {
    throw new AccessError(
      "Du har ikke tilgang til denne tjenesten ennå. Be en administrator om å legge deg til i «GB Studio Builders».",
    );
  }
}

/** Extract the apex (registrable) domain we'd be touching, e.g. app.example.no → example.no. */
export function apexOf(host: string): string {
  const parts = host.trim().replace(/\.$/, "").toLowerCase().split(".");
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

/**
 * Gate mutations by the domain allowlist. Empty allowlist = deny all mutations
 * (safe default) — reads never call this. A domain passes if it equals, or is a
 * subdomain of, an allowlisted apex.
 */
export function assertDomainMutable(domain: string, allowlist: string[]): void {
  if (allowlist.length === 0) {
    throw new AccessError(
      "Ingen domener er åpnet for endring (DOMAIN_ALLOWLIST er tom). En administrator må legge til domenet før det kan endres.",
    );
  }
  const apex = apexOf(domain);
  const ok = allowlist.some((a) => {
    const allowed = a.toLowerCase();
    return apex === allowed || domain.toLowerCase() === allowed || domain.toLowerCase().endsWith(`.${allowed}`);
  });
  if (!ok) {
    throw new AccessError(`Domenet «${domain}» er ikke åpnet for endring. Tillatte: ${allowlist.join(", ")}.`);
  }
}
