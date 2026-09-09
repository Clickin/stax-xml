#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const layout = JSON.parse(await readFile(resolve(root, "abi/layout.json"), "utf8"));
const ts = await readFile(resolve(root, "src/abi.generated.ts"), "utf8");
const as = await readFile(resolve(root, "assembly/abi.generated.ts"), "utf8");
const expected = [
  [ts, "WASM_ABI_VERSION", layout.version],
  [ts, "WASM_CONTROL_BYTES", layout.controlBytes],
  [ts, "WASM_TOKEN_STRIDE", layout.tokenStride],
  [ts, "WASM_ATTRIBUTE_STRIDE", layout.attributeStride],
  [ts, "WASM_SCOPE_HEADER_BYTES", layout.scopeHeaderBytes],
  [ts, "WASM_DECLARATION_BYTES", layout.declarationBytes],
  [as, "ABI_VERSION", layout.version],
  [as, "CONTROL_BYTES", layout.controlBytes],
  [as, "TOKEN_STRIDE", layout.tokenStride],
  [as, "ATTRIBUTE_STRIDE", layout.attributeStride],
];
for (const [source, name, value] of expected) {
  if (!new RegExp(`\\b${name}\\s*(?::[^=]+)?=\\s*${value}\\b`).test(source))
    throw new Error(`ABI generated constant drift: ${name}`);
}
console.log("ABI v2 generated constants match abi/layout.json");
