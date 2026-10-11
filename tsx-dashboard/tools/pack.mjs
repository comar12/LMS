// Compress (brotli) and encrypt (AES-256-GCM) the hosted page into bundle.enc.
// The repository is public, so agent data is only ever committed encrypted; the key lives in the
// Vercel project as the TSX_BUNDLE_KEY environment variable (64 hex chars).
import fs from "node:fs";
import crypto from "node:crypto";
import zlib from "node:zlib";

const [page, keyFile, out] = process.argv.slice(2);
const key = Buffer.from(fs.readFileSync(keyFile, "utf8").trim(), "hex");
if (key.length !== 32) throw new Error("Key must be 32 bytes (64 hex chars)");
const packed = zlib.brotliCompressSync(fs.readFileSync(page), {
  params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT },
});
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const body = Buffer.concat([cipher.update(packed), cipher.final()]);
fs.writeFileSync(out, Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64") + "\n");
console.log(`${out}: ${packed.length} bytes compressed`);
