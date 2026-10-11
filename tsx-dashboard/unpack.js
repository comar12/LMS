// Vercel build step: decrypt bundle.enc with TSX_BUNDLE_KEY and write the static page to public/.
const fs = require("fs"), crypto = require("crypto"), zlib = require("zlib");

const hex = (process.env.TSX_BUNDLE_KEY || "").trim();
if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("TSX_BUNDLE_KEY is missing or not 64 hex characters");
const raw = Buffer.from(fs.readFileSync("bundle.enc", "utf8"), "base64");
const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(hex, "hex"), raw.subarray(0, 12));
decipher.setAuthTag(raw.subarray(12, 28));
const page = zlib.brotliDecompressSync(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]));
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/index.html", page);
console.log(`public/index.html: ${page.length} bytes`);
