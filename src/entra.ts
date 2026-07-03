/**
 * Entra (Azure AD) access-token verification. The MCP is a protected resource:
 * every request must carry a Bearer token that Entra issued for THIS api's
 * audience. We verify signature (RS256 via Entra's JWKS), issuer, audience, and
 * expiry, then read the caller's identity + group membership from the claims.
 *
 * The token is the security boundary — not the LLM, not a shared header key.
 */
import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";

/** A successfully authenticated caller. */
export interface Caller {
  oid: string;
  groups: string[];
  name?: string;
}

export interface VerifierConfig {
  issuer: string;
  audiences: string[];
}

/** Key resolver: Entra's rotating public keys, cached + refreshed by `jose`. */
export type KeyResolver = JWTVerifyGetKey;

export function remoteJwks(jwksUri: string): KeyResolver {
  return createRemoteJWKSet(new URL(jwksUri));
}

export class TokenError extends Error {}

/**
 * Build a verifier. `key` is injectable so tests can pass a local key set while
 * production passes {@link remoteJwks}.
 */
export function createVerifier(cfg: VerifierConfig, key: KeyResolver) {
  return async function verify(token: string): Promise<Caller> {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, key, {
        issuer: cfg.issuer,
        audience: cfg.audiences,
        algorithms: ["RS256"],
      }));
    } catch (err) {
      throw new TokenError(err instanceof Error ? err.message : "token verification failed");
    }
    const oid =
      typeof payload.oid === "string"
        ? payload.oid
        : typeof payload.sub === "string"
          ? payload.sub
          : "";
    if (oid === "") throw new TokenError("token has no oid/sub");
    // NOTE: Entra omits `groups` when the user is in more groups than the token
    // limit ("groups overage") — it emits `_claim_names` instead. For a single
    // dedicated access group this is fine; if we ever hit overage, fall back to
    // a Graph checkMemberGroups call here.
    const groups = Array.isArray(payload.groups)
      ? payload.groups.filter((g: unknown): g is string => typeof g === "string")
      : [];
    const name = typeof payload.name === "string" ? payload.name : undefined;
    return { oid, groups, name };
  };
}

export type Verify = ReturnType<typeof createVerifier>;
