import {
  NEED_INPUT,
  type TokenAdvanceResult,
  type TokenCursor,
  type TokenReadView,
} from "../TokenCursor.js";

/** Sequential consumer for a batched token producer. It never reads input. */
export class TokenCursorConsumer {
  readonly current: TokenReadView;
  private readonly batch;
  private index = 0;
  private length = 0;
  private eof = false;
  private disposed = false;

  constructor(private readonly producer: TokenCursor) {
    this.batch = producer.batch;
    this.current = this.batch.current;
  }

  next(): TokenAdvanceResult {
    if (this.disposed || this.eof) return null;
    if (this.index < this.length) return this.batch.select(this.index++);

    const count = this.producer.fillBatch();
    if (count === NEED_INPUT) return NEED_INPUT;
    if (count === null) {
      this.eof = true;
      return null;
    }
    if (!Number.isSafeInteger(count) || count <= 0)
      throw new Error("Invalid token batch size.");
    this.length = count;
    this.index = 1;
    return this.batch.select(0);
  }

  close(): void {
    this.disposed = true;
    this.index = 0;
    this.length = 0;
  }
}
