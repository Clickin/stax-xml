import type { AnyXmlEvent } from '../types.js';

type BatchCapableSource = AsyncIterator<AnyXmlEvent> & {
  batchedIterator(): AsyncGenerator<AnyXmlEvent[]>;
};

function hasBatchedIterator(source: AsyncIterator<AnyXmlEvent>): source is BatchCapableSource {
  return 'batchedIterator' in source && typeof source.batchedIterator === 'function';
}

export class AsyncEventBatchIterator implements AsyncIterator<AnyXmlEvent>, AsyncIterable<AnyXmlEvent> {
  private readonly batchIterator?: AsyncGenerator<AnyXmlEvent[]>;
  private bufferedEvents: AnyXmlEvent[] = [];
  private bufferedIndex = 0;

  constructor(private readonly source: AsyncIterator<AnyXmlEvent>) {
    if (hasBatchedIterator(source)) {
      this.batchIterator = source.batchedIterator();
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> {
    return this;
  }

  hasBufferedEvents(): boolean {
    return this.bufferedIndex < this.bufferedEvents.length;
  }

  async ensureBatch(): Promise<boolean> {
    if (this.hasBufferedEvents()) {
      return true;
    }

    if (this.batchIterator) {
      const batchResult = await this.batchIterator.next();
      if (batchResult.done || batchResult.value.length === 0) {
        return false;
      }
      this.bufferedEvents = batchResult.value;
      this.bufferedIndex = 0;
      return true;
    }

    const next = await this.source.next();
    if (next.done) {
      return false;
    }

    this.bufferedEvents = [next.value];
    this.bufferedIndex = 0;
    return true;
  }

  nextBuffered(): IteratorResult<AnyXmlEvent> {
    if (!this.hasBufferedEvents()) {
      return { value: undefined, done: true };
    }

    const value = this.bufferedEvents[this.bufferedIndex]!;
    this.bufferedIndex++;

    if (!this.hasBufferedEvents()) {
      this.bufferedEvents = [];
      this.bufferedIndex = 0;
    }

    return { value, done: false };
  }

  async next(): Promise<IteratorResult<AnyXmlEvent>> {
    if (!(await this.ensureBatch())) {
      return { value: undefined, done: true };
    }

    return this.nextBuffered();
  }

  async return(value?: unknown): Promise<IteratorResult<AnyXmlEvent>> {
    this.bufferedEvents = [];
    this.bufferedIndex = 0;

    if ('return' in this.source && typeof this.source.return === 'function') {
      return this.source.return(value as undefined);
    }

    return { value: value as undefined, done: true };
  }
}

export function asAsyncEventBatchIterator(source: AsyncIterator<AnyXmlEvent>): AsyncEventBatchIterator {
  return source instanceof AsyncEventBatchIterator ? source : new AsyncEventBatchIterator(source);
}

export function isAsyncEventIterator(
  iterator: Iterator<AnyXmlEvent> | AsyncIterator<AnyXmlEvent>
): iterator is AsyncIterator<AnyXmlEvent> {
  if (iterator instanceof AsyncEventBatchIterator) {
    return true;
  }

  if (Symbol.asyncIterator in (iterator as object)) {
    return true;
  }

  const constructorName = iterator?.constructor?.name || '';
  return constructorName === 'StaxXmlParser' || constructorName.includes('Async');
}
