import { closeSync, writeSync } from 'node:fs';
import type { SyncTextSink } from '../StaxXmlWriterSync.js';

type NodeCloseMethod = 'end' | 'close' | 'destroy';

export interface NodeSyncTextSinkTarget {
  write(chunk: string, encoding?: string): unknown;
  flush?: () => unknown;
  end?: (...args: unknown[]) => unknown;
  close?: () => unknown;
  destroy?: (...args: unknown[]) => unknown;
}

export interface NodeSyncTextSinkOptions {
  encoding?: string;
  closeMethod?: NodeCloseMethod;
}

export interface NodeFileSyncTextSinkOptions {
  encoding?: BufferEncoding;
  closeOnExit?: boolean;
}

export class StaxXmlWriterNodeSink implements SyncTextSink {
  public constructor(
    private readonly target: NodeSyncTextSinkTarget,
    private readonly options: NodeSyncTextSinkOptions = {}
  ) {}

  write(chunk: string): void {
    this.target.write(chunk, this.options.encoding ?? 'utf8');
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

    if (closeMethod === 'destroy' && typeof this.target.destroy === 'function') {
      this.target.destroy();
      return;
    }

    if (closeMethod === 'end') {
      if (typeof this.target.end === 'function') {
        this.target.end();
      }
      return;
    }

    if (typeof this.target.end === 'function') {
      this.target.end();
      return;
    }

    if (typeof this.target.close === 'function') {
      this.target.close();
      return;
    }

    if (typeof this.target.destroy === 'function') {
      this.target.destroy();
    }
  }
}

export class StaxXmlWriterNodeFileSyncSink implements SyncTextSink {
  public constructor(
    private readonly fd: number,
    private readonly options: NodeFileSyncTextSinkOptions = {}
  ) {}

  write(chunk: string): void {
    writeSync(this.fd, chunk, undefined, this.options.encoding ?? 'utf8');
  }

  close(): void {
    if (this.options.closeOnExit !== false) {
      closeSync(this.fd);
    }
  }
}

export function createNodeSyncTextSink(
  target: NodeSyncTextSinkTarget,
  options?: NodeSyncTextSinkOptions
): SyncTextSink {
  return new StaxXmlWriterNodeSink(target, options);
}

export function createNodeFileSyncTextSink(
  fd: number,
  options?: NodeFileSyncTextSinkOptions
): SyncTextSink {
  return new StaxXmlWriterNodeFileSyncSink(fd, options);
}

export default createNodeSyncTextSink;
