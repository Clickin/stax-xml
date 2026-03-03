import { RunStatus, SyncByteSource, AsyncByteSource } from "../src/internal/byte-stream/types";
import { MinimalByteSink } from "../src/internal/byte-stream/sink";

describe("internal/byte-stream runtime primitives - runtime shape tests", () => {
  test("RunStatus numeric values", () => {
    expect(RunStatus.OK).toBe(0);
    expect(RunStatus.NEED_INPUT).toBe(1);
    expect(RunStatus.NEED_DRAIN).toBe(2);
    expect(RunStatus.DONE).toBe(3);
    expect(RunStatus.ERROR).toBe(4);
  });

  test("ByteSink minimal backpressure semantics", async () => {
    const sink = new MinimalByteSink(16);
    expect(sink.write(new Uint8Array([1,2,3,4]))).toBe(true);
    // drain should reset state
    await sink.drain();
    expect(sink.write(new Uint8Array([5,6]))).toBe(true);
  });

  test("SyncByteSource EOF signaling", () => {
    class TestSync implements SyncByteSource {
      private emitted = false;
      read(): Uint8Array | null {
        if (this.emitted) return null;
        this.emitted = true;
        return new Uint8Array([9, 9]);
      }
    }
    const s = new TestSync();
    const a = s.read();
    const b = s.read();
    expect(a).toBeInstanceOf(Uint8Array);
    expect(b).toBeNull();
  });

  test("AsyncByteSource EOF signaling", async () => {
    class TestAsync implements AsyncByteSource {
      private emitted = false;
      async read(): Promise<Uint8Array | null> {
        if (this.emitted) return null;
        this.emitted = true;
        return new Uint8Array([8, 8]);
      }
    }
    const s = new TestAsync();
    const v1 = await s.read();
    const v2 = await s.read();
    expect(v1).toBeInstanceOf(Uint8Array);
    expect(v2).toBeNull();
  });
});
