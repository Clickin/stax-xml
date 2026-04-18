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

export function createNodeSyncTextSink(
  target: NodeSyncTextSinkTarget,
  options?: NodeSyncTextSinkOptions
): SyncTextSink {
  return new StaxXmlWriterNodeSink(target, options);
}

export default createNodeSyncTextSink;
