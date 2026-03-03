import { ByteSink } from './types';

// A minimal in-memory ByteSink implementation used for tests and basic usage
export class InMemoryByteSink implements ByteSink {
  private capacity: number;
  private used: number = 0;
  private chunks: Uint8Array[] = [];

  constructor(capacity: number = 1024) {
    this.capacity = capacity;
  }

  write(chunk: Uint8Array): boolean {
    if (this.used + chunk.length > this.capacity) {
      return false;
    }
    this.chunks.push(chunk);
    this.used += chunk.length;
    return true;
  }

  async drain(): Promise<void> {
    // Simulate asynchronous drain
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    this.chunks = [];
    this.used = 0;
  }

  close(): void {
    // no-op for in-memory sink
  }

  abort(reason?: Error): void {
    // no-op for in-memory sink
  }
}
