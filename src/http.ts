import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Config } from "./config.js";
import { buildServer } from "./server.js";
import { AccessError, assertInGroup } from "./authz.js";
import { TokenError, type Caller, type Verify } from "./entra.js";

const META_PATH = "/.well-known/oauth-protected-resource";

export function createApp(config: Config, verify: Verify): express.Express {
  const app = express();
  app.use(express.json());

  // RFC 9728: lets an MCP client discover that Entra is our authorization server.
  app.get(META_PATH, (_req, res) => {
    res.json({
      resource: config.entra.audience,
      authorization_servers: [config.entra.issuer],
      bearer_methods_supported: ["header"],
      scopes_supported: [`${config.entra.audience}/access_as_user`],
    });
  });

  app.get("/healthz", (_req, res) => {
    res.type("text/plain").send("ok");
  });

  app.post("/mcp", async (req, res) => {
    let caller: Caller;
    try {
      const header = req.header("authorization") ?? "";
      if (!header.startsWith("Bearer ")) throw new TokenError("missing bearer token");
      caller = await verify(header.slice("Bearer ".length));
      assertInGroup(caller, config.entra.requiredGroupId);
    } catch (err) {
      if (err instanceof AccessError) {
        res.status(403).json({ error: err.message });
        return;
      }
      // Point the client at the resource metadata so it can start the Entra OAuth flow.
      res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${config.publicUrl}${META_PATH}"`);
      res.status(401).json({ error: err instanceof TokenError ? err.message : "unauthorized" });
      return;
    }

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
    });
    const server = buildServer(caller, config);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body as unknown);
  });

  return app;
}
