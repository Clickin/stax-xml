import type { SyncTextSink } from '../WriterSync.js';

export interface BunSyncTextSinkTarget {
  write(data: string): unknown;
  flush?: () => unknown;
  end?: () => unknown;
  close?: () => unknown;
}

export interface BunSyncTextSinkOptions {
  closeMethod?: 'end' | 'close';
}

export class WriterBunSink implements SyncTextSink {
  public constructor(
    private readonly target: BunSyncTextSinkTarget,
    private readonly options: BunSyncTextSinkOptions = {}
  ) {}

  write(chunk: string): void {
    this.target.write(chunk);
  }

  flush(): void {
    if (typeof this.target.flush === 'function') {
      this.target.flush();
    }
  }

  close(): void {
    const closeMethod = this.options.closeMethod;

    if (closeMethod === 'close' && typeof this.target.close === 'function') {
      this.target.close();
      return;
    }

    if (closeMethod === 'end' && typeof this.target.end === 'function') {
      this.target.end();
      return;
    }

    if (typeof this.target.end === 'function') {
      this.target.end();
      return;
    }

    if (typeof this.target.close === 'function') {
      this.target.close();
    }
  }
}

export function createBunSyncTextSink(
  target: BunSyncTextSinkTarget,
  options?: BunSyncTextSinkOptions
): SyncTextSink {
  return new WriterBunSink(target, options);
}

export default createBunSyncTextSink;
