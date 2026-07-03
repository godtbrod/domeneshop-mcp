import { describe, it, expect } from "vitest";
import { AccessError, apexOf, assertDomainMutable, assertInGroup } from "../src/authz.js";
import type { Caller } from "../src/entra.js";

const GROUP = "659888ab-5511-4ab1-bd5e-8defe02a5c89";
const caller = (groups: string[]): Caller => ({ oid: "u1", groups });

describe("group gate", () => {
  it("passes a caller in the required group", () => {
    expect(() => assertInGroup(caller([GROUP, "other"]), GROUP)).not.toThrow();
  });
  it("blocks a caller not in the group", () => {
    expect(() => assertInGroup(caller(["other"]), GROUP)).toThrow(AccessError);
  });
  it("blocks a caller with no groups (overage or none)", () => {
    expect(() => assertInGroup(caller([]), GROUP)).toThrow(AccessError);
  });
});

describe("apexOf", () => {
  it("returns the registrable apex", () => {
    expect(apexOf("app.example.no")).toBe("example.no");
    expect(apexOf("a.b.c.example.no")).toBe("example.no");
    expect(apexOf("example.no")).toBe("example.no");
    expect(apexOf("Example.NO.")).toBe("example.no");
  });
});

describe("domain allowlist", () => {
  it("denies every mutation when the allowlist is empty", () => {
    expect(() => assertDomainMutable("example.no", [])).toThrow(AccessError);
  });
  it("allows an exact apex match", () => {
    expect(() => assertDomainMutable("example.no", ["example.no"])).not.toThrow();
  });
  it("allows a subdomain of an allowlisted apex", () => {
    expect(() => assertDomainMutable("apps.example.no", ["example.no"])).not.toThrow();
  });
  it("denies a domain not on the allowlist", () => {
    expect(() => assertDomainMutable("evil.no", ["example.no"])).toThrow(AccessError);
  });
});
