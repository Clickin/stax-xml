const ERROR_MESSAGES: Readonly<Record<number, string>> = {
  1: "Malformed XML.",
  2: "Invalid XML character.",
  3: "Tokenizer state error.",
};

export function wasmErrorMessage(code: number): string {
  return ERROR_MESSAGES[code] ?? `WebAssembly tokenizer error (code ${code}).`;
}

export class TokenCursorWasmError extends Error {
  readonly code: number;
  readonly position: number | undefined;
  readonly bytePosition: number | undefined;

  constructor(message: string, code: number, position: number | undefined) {
    super(message);
    this.name = "TokenCursorWasmError";
    this.code = code;
    this.position = position;
    this.bytePosition = position;
  }
}
