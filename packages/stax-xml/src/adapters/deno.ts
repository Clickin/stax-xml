import type { SyncTextSink } from '../WriterSync.js';

export interface DenoSyncTextSinkTarget {
  writeTextSync?: (text: string) => unknown;
  writeSync?: (chunk: Uint8Array) => number;
  flushSync?: () => unknown;
  flush?: () => unknown;
  close?: () => unknown;
}

export class WriterDenoSink implements SyncTextSink {
  private readonly encoder = new TextEncoder();

  constructor(private readonly target: DenoSyncTextSinkTarget) {}

  write(chunk: string): void {
    if (typeof this.target.writeTextSync === 'function') {
      this.target.writeTextSync(chunk);
      return;
    }

    if (typeof this.target.writeSync === 'function') {
      this.target.writeSync(this.encoder.encode(chunk));
      return;
    }

    throw new Error('Unsupported Deno sink: provide writeTextSync or writeSync');
  }

  flush(): void {
    if (typeof this.target.flushSync === 'function') {
      this.target.flushSync();
      return;
    }

    if (typeof this.target.flush === 'function') {
      this.target.flush();
    }
  }

  close(): void {
    if (typeof this.target.close === 'function') {
      this.target.close();
    }
  }
}

export function createDenoSyncTextSink(target: DenoSyncTextSinkTarget): SyncTextSink {
  return new WriterDenoSink(target);
}

export default createDenoSyncTextSink;
