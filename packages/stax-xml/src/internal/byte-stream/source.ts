import { SyncByteSource, AsyncByteSource } from './types';

// Simple synchronous byte source for testing and minimal usage
export class SimpleSyncByteSource implements SyncByteSource {
  private parts: Uint8Array[];
  private idx: number = 0;

  constructor(parts: Uint8Array[]) {
    this.parts = parts;
  }

  read(): Uint8Array | null {
    if (this.idx < this.parts.length) {
      const chunk = this.parts[this.idx++];
      return chunk;
    }
    return null;
  }
}

// Simple asynchronous byte source for testing and minimal usage
export class SimpleAsyncByteSource implements AsyncByteSource {
  private parts: Uint8Array[];
  private idx: number = 0;

  constructor(parts: Uint8Array[]) {
    this.parts = parts;
  }

  async read(): Promise<Uint8Array | null> {
    if (this.idx < this.parts.length) {
      const chunk = this.parts[this.idx++];
      return chunk;
    }
    return null;
  }
}
