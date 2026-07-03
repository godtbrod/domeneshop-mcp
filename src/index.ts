import { loadConfig } from "./config.js";
import { createVerifier, remoteJwks } from "./entra.js";
import { createApp } from "./http.js";

const config = loadConfig();
const verify = createVerifier(
  { issuer: config.entra.issuer, audiences: config.entra.audiences },
  remoteJwks(config.entra.jwksUri),
);
const app = createApp(config, verify);

app.listen(config.port, config.bind, () => {
  process.stderr.write(`domeneshop-mcp listening on ${config.bind}:${config.port}\n`);
});
