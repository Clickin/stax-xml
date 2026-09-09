import { describe, expect, it } from "vitest";
import {
  NEED_INPUT,
  WasmTokenInputSession,
  initWasm,
} from "@stax-xml/wasm";

const encoder = new TextEncoder();
const variants = ["scalar", "simd"] as const;
const TARGET_BYTES = 128 * 1024 * 1024;
const CHUNK_BYTES = 1024 * 1024;

function processMemory(): { heap: number; rss: number } {
  const memory = process.memoryUsage();
  return { heap: memory.heapUsed, rss: memory.rss };
}

describe.each(variants)("bounded WASM streaming memory (%s)", (variant) => {
  it(
    "drains reusable chunks without retaining the cumulative document",
    async () => {
      await initWasm({ variant });
      const session = new WasmTokenInputSession({});
      const cursor = session.cursor;
      const open = encoder.encode("<root>");
      const close = encoder.encode("</root>");
      const itemOpen = encoder.encode("<item>");
      const itemClose = encoder.encode("</item>");
      const reusableChunk = new Uint8Array(CHUNK_BYTES);
      reusableChunk.set(itemOpen);
      reusableChunk.fill(
        0x78,
        itemOpen.byteLength,
        CHUNK_BYTES - itemClose.byteLength,
      );
      reusableChunk.set(itemClose, CHUNK_BYTES - itemClose.byteLength);
      let documentSize = 0;
      let maxInputCapacity = 0;
      let atEightMiB: { pages: number; inputCapacity: number } | undefined;

      const drain = (): void => {
        for (;;) {
          const result = cursor.next();
          if (result === NEED_INPUT || result === null) return;
        }
      };
      const observe = (): void => {
        const stats = cursor.memoryStats();
        maxInputCapacity = Math.max(maxInputCapacity, stats.inputCapacity);
        if (documentSize >= 8 * 1024 * 1024 && atEightMiB === undefined)
          atEightMiB = stats;
      };

      // The cursor must ask for input before each reusable chunk is committed.
      expect(cursor.next()).toBe(NEED_INPUT);
      session.pushBytes(open);
      documentSize += open.byteLength;
      drain();
      observe();

      for (let offset = 0; offset < TARGET_BYTES; offset += CHUNK_BYTES) {
        expect(cursor.next()).toBe(NEED_INPUT);
        session.pushBytes(reusableChunk);
        documentSize += reusableChunk.byteLength;
        drain();
        observe();
      }

      const retained = cursor.memoryStats();
      expect(cursor.next()).toBe(NEED_INPUT);
      session.pushBytes(close, true);
      documentSize += close.byteLength;
      drain();
      observe();
      const beforeDispose = {
        wasm: cursor.memoryStats(),
        process: processMemory(),
      };
      const threshold = atEightMiB;
      expect(documentSize).toBeGreaterThanOrEqual(TARGET_BYTES);
      expect(threshold).toBeDefined();
      expect(retained.inputCapacity).toBe(threshold!.inputCapacity);
      expect(retained.pages).toBe(threshold!.pages);
      expect(maxInputCapacity).toBe(retained.inputCapacity);

      session.dispose();
      const afterDispose = cursor.memoryStats();
      console.info(
        "[wasm-memory]",
        JSON.stringify({
          variant,
          documentSize,
          maxInputCapacity,
          retained,
          beforeDispose: {
            pages: beforeDispose.wasm.pages,
            inputCapacity: beforeDispose.wasm.inputCapacity,
            heap: beforeDispose.process.heap,
            rss: beforeDispose.process.rss,
          },
          afterDispose: {
            pages: afterDispose.pages,
            inputCapacity: afterDispose.inputCapacity,
            heap: processMemory().heap,
            rss: processMemory().rss,
          },
        }),
      );
    },
    120_000,
  );
});
