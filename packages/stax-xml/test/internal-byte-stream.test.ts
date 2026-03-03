import { RunStatus, SyncByteSource, AsyncByteSource, ByteSink } from '../src/internal/index';

describe('Internal Byte Stream Primitives', () => {
  test('RunStatus values are 0..4', () => {
    expect(RunStatus.OK).toBe(0);
    expect(RunStatus.NEED_INPUT).toBe(1);
    expect(RunStatus.NEED_DRAIN).toBe(2);
    expect(RunStatus.DONE).toBe(3);
    expect(RunStatus.ERROR).toBe(4);
  });

  test('SyncByteSource returns data then null', () => {
    let consumed = false;
    const source: SyncByteSource = {
      read(): Uint8Array | null {
        if (!consumed) {
          consumed = true;
          return new Uint8Array([1, 2, 3]);
        }
        return null;
      }
    };

    const first = source.read();
    expect(first).toBeInstanceOf(Uint8Array as any);
    expect(first?.length).toBe(3);
    const second = source.read();
    expect(second).toBeNull();
  });

  test('AsyncByteSource returns data then null', async () => {
    let consumed = false;
    const source: AsyncByteSource = {
      async read(): Promise<Uint8Array | null> {
        if (!consumed) {
          consumed = true;
          return new Uint8Array([9, 9]);
        }
        return null;
      }
    };

    const a = await source.read();
    expect(a).toBeInstanceOf(Uint8Array as any);
    expect(a?.length).toBe(2);
    const b = await source.read();
    expect(b).toBeNull();
  });

  test('ByteSink write and drain behavior', async () => {
    class TestSink implements ByteSink {
      capacity: number;
      used: number = 0;
      chunks: Uint8Array[] = [];
      constructor(cap: number) { this.capacity = cap; }
      write(chunk: Uint8Array): boolean {
        if (this.used + chunk.length > this.capacity) return false;
        this.chunks.push(chunk);
        this.used += chunk.length;
        return true;
      }
      async drain(): Promise<void> {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        this.chunks = [];
        this.used = 0;
      }
      close(): void {
        // no-op
      }
      abort(reason?: Error): void {
        // no-op
      }
    }

    const sink = new TestSink(4);
    expect(sink.write(new Uint8Array([1, 2]))).toBe(true);
    expect(sink.write(new Uint8Array([3, 4]))).toBe(true);
    // Exceeds capacity
    expect(sink.write(new Uint8Array([5]))).toBe(false);
    await sink.drain();
    // After drain we should be able to write again
    expect(sink.write(new Uint8Array([6]))).toBe(true);
  });
});
