# @godtbrod/domeneshop-mcp

The **Domeneshop MCP for GB Studio** — a rebuild of the identity model's pilot in our own
stack (TypeScript / Node, `@modelcontextprotocol/sdk`, `jose`, `express`). It manages
Domeneshop DNS records for published apps, but with the studio's security posture:

- **Entra-authenticated.** Every request must carry a valid **Entra access token** for this
  MCP's audience. We verify signature (RS256 via Entra JWKS), issuer, audience, and expiry.
  The token is the security boundary — not a shared header key.
- **Group-gated.** The caller must be a member of **GB Studio Builders**
  (`REQUIRED_GROUP_ID`), read from the token's `groups` claim.
- **Key held server-side.** The Domeneshop `token`/`secret` live only in this server's env —
  never in a user's config or `.env`.
- **Guardrailed.** Mutations are restricted to an allowlist of domains (`DOMAIN_ALLOWLIST`);
  an empty allowlist denies all changes (reads still work). Every call is **audited** to
  stderr (caller `oid`, action, outcome).
- **Discoverable.** Serves `/.well-known/oauth-protected-resource` (RFC 9728) and a
  `WWW-Authenticate` challenge so an MCP client can find Entra and start the OAuth flow.

## Tools
`list_domains` · `list_dns_records` · `create_dns_record` · `update_dns_record` ·
`delete_dns_record` (the last three allowlist-gated).

## Configure
Copy `.env.example` → `.env` and fill in (see that file). Key vars: `ENTRA_TENANT_ID`,
`ENTRA_AUDIENCE`, `REQUIRED_GROUP_ID`, `DOMENESHOP_TOKEN`, `DOMENESHOP_SECRET`,
`DOMAIN_ALLOWLIST`, `PUBLIC_URL`.

## Run
```
pnpm install
pnpm test          # 15 tests: token verification + authz + allowlist
pnpm build && pnpm start
# or: docker build -t domeneshop-mcp . && docker run --env-file .env -p 3900:3900 domeneshop-mcp
```

## Register with Claude Code (user scope, once)
```
claude mcp add --transport http domeneshop https://<our-host>/mcp --scope user
```
No secret in the command — Claude Code discovers Entra via the resource-metadata document and
runs the sign-in. (Remaining wiring for full end-to-end: expose an `access_as_user` scope on
the Entra app and confirm the Claude Code ↔ Entra OAuth client registration — see
`gb-studio/docs/domeneshop-mcp.md`.)

## Security model
See [`gb-studio/docs/identity.md`](https://github.com/godtbrod/gb-studio/blob/main/docs/identity.md).
Rebuilt from the upstream Rust MCP ([lille-morille/domeneshop-mcp](https://github.com/lille-morille/domeneshop-mcp))
in our stack so we can own the auth layer, test it, and reuse it across the other GB service MCPs.
