import { describe, expect, it } from "vitest";
import {
  EventReaderSync,
  StreamReaderSync,
} from "@stax-xml/wasm";

const encoder = new TextEncoder();

function readSync(input: string | Uint8Array, options?: { encoding?: string }): string[] {
  const reader = new StreamReaderSync(input, options);
  const values: string[] = [];
  try {
    while (reader.next() !== null) {
      if (reader.name() !== undefined) values.push(reader.name()!);
      if (reader.text() !== undefined) values.push(reader.text()!);
    }
    return values;
  } finally {
    reader.close();
  }
}

function utf16le(value: string): Uint8Array {
  const bytes = new Uint8Array(2 + value.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let index = 0; index < value.length; index++) {
    const codeUnit = value.charCodeAt(index);
    bytes[2 + index * 2] = codeUnit & 0xff;
    bytes[3 + index * 2] = codeUnit >>> 8;
  }
  return bytes;
}

describe("WASM package lifecycle and fallback paths", () => {
  it("rejects UTF-8 byte input before initWasm with a clear error", () => {
    expect(() => new StreamReaderSync(encoder.encode("<r/>"))).toThrow(
      Error,
    );
    expect(() => new EventReaderSync(encoder.encode("<r/>"))).toThrow(
      Error,
    );
  });

  it("keeps direct strings on the JS path before initialization", () => {
    expect(readSync("<r>before init</r>")).toEqual(["r", "before init", "r"]);
  });

  it("keeps non-UTF-8 bytes on the JS TextDecoder path before initialization", () => {
    expect(readSync(utf16le("<r>utf16</r>"), { encoding: "utf-16le" })).toEqual([
      "r",
      "utf16",
      "r",
    ]);
  });

  it("shares initialization with the built converter subpath", async () => {
    const { initWasm } = await import("../dist/index.js");
    const { withWasmBackend } = await import("../dist/converter.js");
    const { x } = await import("stax-xml/converter");
    await initWasm({ variant: "scalar" });
    expect(
      x.string("/r").parseSync(
        encoder.encode("<r>shared module</r>"),
        withWasmBackend({}),
      ),
    ).toBe("shared module");
  });
});
