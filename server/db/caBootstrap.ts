import fs from "node:fs";
import path from "node:path";

export function ensureExtraCaCertsFromEnv(): void {
  if (process.env.NODE_EXTRA_CA_CERTS) return;

  const raw = process.env.PGSSLROOTCERT;
  if (!raw) return;

  const pem = raw
    .trim()
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");

  const filePath = path.join("/tmp", "supabase-ca.pem");
  fs.writeFileSync(filePath, pem, { encoding: "utf8" });

  process.env.NODE_EXTRA_CA_CERTS = filePath;

  if (process.env.VERCEL && process.env.NODE_ENV === "production") {
    console.log("[TLS] NODE_EXTRA_CA_CERTS configured", {
      pemLen: pem.length,
    });
  }
}

