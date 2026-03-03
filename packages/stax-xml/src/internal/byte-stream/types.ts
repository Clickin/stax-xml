export interface SyncByteSource {
  read(): Uint8Array | null;
}

export interface AsyncByteSource {
  read(): Promise<Uint8Array | null>;
}

export interface ByteSink {
  write(chunk: Uint8Array): boolean;
  drain(): Promise<void>;
  close(): void;
  abort(reason?: Error): void;
}

export enum RunStatus {
  OK = 0,
  NEED_INPUT = 1,
  NEED_DRAIN = 2,
  DONE = 3,
  ERROR = 4
}
