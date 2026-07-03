import { describe, it, expect } from "vitest";
import { SignJWT, generateKeyPair, type JWTVerifyGetKey, type CryptoKey } from "jose";
import { createVerifier, TokenError } from "../src/entra.js";

const ISSUER = "https://login.microsoftonline.com/test-tenant/v2.0";
const AUD = "api://test-app";

async function harness() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const resolver: JWTVerifyGetKey = async () => publicKey;
  const verify = createVerifier({ issuer: ISSUER, audiences: [AUD] }, resolver);
  const sign = (
    claims: Record<string, unknown>,
    opts: { iss?: string; aud?: string; exp?: string | number } = {},
  ): Promise<string> =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(opts.iss ?? ISSUER)
      .setAudience(opts.aud ?? AUD)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "5m")
      .sign(privateKey as CryptoKey);
  return { verify, sign };
}

describe("Entra token verification", () => {
  it("accepts a valid token and extracts oid, name, groups", async () => {
    const { verify, sign } = await harness();
    const token = await sign({ oid: "user-1", name: "Test Person", groups: ["g-1", "g-2"] });
    const caller = await verify(token);
    expect(caller.oid).toBe("user-1");
    expect(caller.name).toBe("Test Person");
    expect(caller.groups).toEqual(["g-1", "g-2"]);
  });

  it("falls back to sub when oid is absent, and defaults groups to []", async () => {
    const { verify, sign } = await harness();
    const token = await sign({ sub: "subject-9" });
    const caller = await verify(token);
    expect(caller.oid).toBe("subject-9");
    expect(caller.groups).toEqual([]);
  });

  it("rejects a token with the wrong audience", async () => {
    const { verify, sign } = await harness();
    const token = await sign({ oid: "user-1" }, { aud: "api://someone-else" });
    await expect(verify(token)).rejects.toBeInstanceOf(TokenError);
  });

  it("rejects a token from the wrong issuer", async () => {
    const { verify, sign } = await harness();
    const token = await sign({ oid: "user-1" }, { iss: "https://evil.example/v2.0" });
    await expect(verify(token)).rejects.toBeInstanceOf(TokenError);
  });

  it("rejects an expired token", async () => {
    const { verify, sign } = await harness();
    const token = await sign({ oid: "user-1" }, { exp: Math.floor(Date.now() / 1000) - 60 });
    await expect(verify(token)).rejects.toBeInstanceOf(TokenError);
  });

  it("rejects a token signed by a different key", async () => {
    const { verify } = await harness();
    const { privateKey: otherKey } = await generateKeyPair("RS256");
    const forged = await new SignJWT({ oid: "user-1" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(ISSUER)
      .setAudience(AUD)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(otherKey as CryptoKey);
    await expect(verify(forged)).rejects.toBeInstanceOf(TokenError);
  });

  it("rejects garbage", async () => {
    const { verify } = await harness();
    await expect(verify("not-a-jwt")).rejects.toBeInstanceOf(TokenError);
  });
});
