import type { SyncTextSink } from '../StaxXmlWriterSync.js';

export interface DenoSyncTextSinkTarget {
  writeText?: (text: string) => unknown;
  writeTextSync?: (text: string) => unknown;
  writeSync?: (chunk: Uint8Array) => number;
  write?: (chunk: Uint8Array) => Promise<number> | number;
  close?: () => unknown;
}

export class StaxXmlWriterDenoSink implements SyncTextSink {
  private readonly encoder = new TextEncoder();

  constructor(private readonly target: DenoSyncTextSinkTarget) {}

  write(chunk: string): void {
    if (typeof this.target.writeTextSync === 'function') {
      this.target.writeTextSync(chunk);
      return;
    }

    if (typeof this.target.writeText === 'function') {
      this.target.writeText(chunk);
      return;
    }

    if (typeof this.target.writeSync === 'function') {
      this.target.writeSync(this.encoder.encode(chunk));
      return;
    }

    if (typeof this.target.write === 'function') {
      this.target.write(this.encoder.encode(chunk));
      return;
    }

    throw new Error('Unsupported Deno sink: provide writeTextSync, writeText, writeSync, or write');
  }

  flush(): void {
    // Optional, if target adds a sync flush API in future.
    if ('flush' in this.target && typeof (this.target as { flush?: () => unknown }).flush === 'function') {
      (this.target as { flush: () => unknown }).flush();
    }
  }

  close(): void {
    if (typeof this.target.close === 'function') {
      this.target.close();
    }
  }
}

export function createDenoSyncTextSink(target: DenoSyncTextSinkTarget): SyncTextSink {
  return new StaxXmlWriterDenoSink(target);
}

export default createDenoSyncTextSink;
