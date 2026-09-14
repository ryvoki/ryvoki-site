// Generates the ECDSA P-256 key pair used to sign license verification responses.
// Run:  npm run keys
//   - PRIVATE key -> signing-key.private.json (git-ignored). Copy its contents into Cloudflare
//                    as the LICENSE_SIGNING_KEY secret. Locally, .dev.vars is updated for you.
//   - PUBLIC key  -> signing-key.public.spki.txt. Paste into the desktop app (LicenseConfig.PublicKeySpki).
// The private key is deliberately never printed to the terminal.
import { webcrypto } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const { subtle } = webcrypto;
const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const priv = await subtle.exportKey("jwk", pair.privateKey);
const pub = await subtle.exportKey("jwk", pair.publicKey);
const spki = Buffer.from(await subtle.exportKey("spki", pair.publicKey)).toString("base64");

writeFileSync("signing-key.private.json", JSON.stringify(priv));
writeFileSync("signing-key.public.json", JSON.stringify(pub, null, 2));
writeFileSync("signing-key.public.spki.txt", spki + "\n");

if (existsSync(".dev.vars")) {
  const lines = readFileSync(".dev.vars", "utf8").split(/\r?\n/);
  const line = "LICENSE_SIGNING_KEY=" + JSON.stringify(priv);
  const i = lines.findIndex(l => l.startsWith("LICENSE_SIGNING_KEY="));
  if (i >= 0) lines[i] = line; else lines.push(line);
  writeFileSync(".dev.vars", lines.join("\n"));
}

console.log("\nNew key pair generated.");
console.log("  PRIVATE key -> signing-key.private.json   (secret; paste into Cloudflare as LICENSE_SIGNING_KEY)");
console.log("  .dev.vars   -> " + (existsSync(".dev.vars") ? "updated" : "not present, skipped"));
console.log("  PUBLIC key  -> signing-key.public.spki.txt (embed in the desktop app):\n");
console.log(spki + "\n");
console.log("Remember: every time you regenerate, the app must be rebuilt with the new public key.\n");
