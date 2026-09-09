#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const layout = JSON.parse(await readFile(resolve(root, "abi/layout.json"), "utf8"));
const ts = `export const WASM_ABI_VERSION = ${layout.version} as const;
export const WASM_CONTROL_BYTES = ${layout.controlBytes};
export const WASM_TOKEN_STRIDE = ${layout.tokenStride};
export const WASM_ATTRIBUTE_STRIDE = ${layout.attributeStride};
export const WASM_SCOPE_HEADER_BYTES = ${layout.scopeHeaderBytes};
export const WASM_DECLARATION_BYTES = ${layout.declarationBytes};
export const WASM_SELF_CLOSING_FLAG = ${layout.flags.selfClosing};
export const WASM_SCOPE_VISIBLE_FLAG = ${layout.flags.scopeVisible};
`;
const as = `export const ABI_VERSION: i32 = ${layout.version};
export const CONTROL_BYTES: usize = ${layout.controlBytes};
export const TOKEN_STRIDE: usize = ${layout.tokenStride};
export const ATTRIBUTE_STRIDE: usize = ${layout.attributeStride};
`;
await writeFile(resolve(root, "src/abi.generated.ts"), ts);
await writeFile(resolve(root, "assembly/abi.generated.ts"), as);
