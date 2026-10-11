// Minify inline <script> and <style> blocks of a single-file page (syntax-aware, via esbuild).
import fs from "node:fs";
import { transformSync } from "esbuild";
const [src, out] = process.argv.slice(2);
let html = fs.readFileSync(src, "utf8");
html = html.replace(/<script>([\s\S]*?)<\/script>/g, (_, code) =>
  "<script>" + transformSync(code, { loader: "js", minify: true, target: "es2020", legalComments: "inline" }).code.trim() + "</script>");
html = html.replace(/<style>([\s\S]*?)<\/style>/g, (_, css) =>
  "<style>" + transformSync(css, { loader: "css", minify: true }).code.trim() + "</style>");
html = html.replace(/\n{2,}/g, "\n");
fs.writeFileSync(out, html);
