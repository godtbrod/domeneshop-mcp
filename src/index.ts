import dotenvx from "@dotenvx/dotenvx";
import { loadConfig } from "./config.js";
import { createVerifier, remoteJwks } from "./entra.js";
import { createApp } from "./http.js";

// Secrets live in a dotenvx-ENCRYPTED .env (safe to commit / bake into the image).
// The only real secret is the decryption key (DOTENV_PRIVATE_KEY), supplied at
// runtime from the studio Key Vault via an ExternalSecret. Decrypt before reading config.
dotenvx.config();

const config = loadConfig();
const verify = createVerifier(
  { issuer: config.entra.issuer, audiences: config.entra.audiences },
  remoteJwks(config.entra.jwksUri),
);
const app = createApp(config, verify);

app.listen(config.port, config.bind, () => {
  process.stderr.write(`domeneshop-mcp listening on ${config.bind}:${config.port}\n`);
});
