import { describe, expect, it } from 'vitest';
import {
  asAsyncEventBatchIterator,
  AsyncEventBatchIterator,
  isAsyncEventIterator
} from '../../src/converter/AsyncEventBatchIterator.js';
import { XmlEventFactory, type AnyXmlEvent } from '../../src/types.js';

const text = (value: string): AnyXmlEvent => XmlEventFactory.characters(value);

async function* asyncEvents(events: AnyXmlEvent[]): AsyncGenerator<AnyXmlEvent> {
  for (const event of events) {
    yield event;
  }
}

describe('AsyncEventBatchIterator', () => {
  it('buffers one event at a time for plain async iterators', async () => {
    const reader = new AsyncEventBatchIterator(asyncEvents([
      text('first'),
      text('second')
    ]));

    expect(reader[Symbol.asyncIterator]()).toBe(reader);
    expect(reader.hasBufferedEvents()).toBe(false);
    expect(await reader.ensureBatch()).toBe(true);
    expect(await reader.ensureBatch()).toBe(true);
    expect(reader.hasBufferedEvents()).toBe(true);
    expect(reader.nextBuffered()).toEqual({ value: text('first'), done: false });
    expect(reader.hasBufferedEvents()).toBe(false);

    await expect(reader.next()).resolves.toEqual({ value: text('second'), done: false });
    await expect(reader.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('reads from batched sources and stops on empty batches', async () => {
    const source = {
      async next() {
        return { value: undefined, done: true } as IteratorResult<AnyXmlEvent>;
      },
      async *batchedIterator() {
        yield [text('a'), text('b')];
        yield [];
        yield [text('unreachable')];
      }
    };

    const reader = new AsyncEventBatchIterator(source);

    expect(await reader.ensureBatch()).toBe(true);
    expect(reader.nextBuffered()).toEqual({ value: text('a'), done: false });
    expect(reader.nextBuffered()).toEqual({ value: text('b'), done: false });
    expect(reader.nextBuffered()).toEqual({ value: undefined, done: true });
    expect(await reader.ensureBatch()).toBe(false);
  });

  it('clears buffers and delegates return to the wrapped source', async () => {
    let returnedValue: unknown;
    const source = {
      async next() {
        return { value: text('pending'), done: false } as IteratorResult<AnyXmlEvent>;
      },
      async return(value?: unknown) {
        returnedValue = value;
        return { value: text('closed'), done: true } as IteratorResult<AnyXmlEvent>;
      }
    };

    const reader = new AsyncEventBatchIterator(source);

    expect(await reader.ensureBatch()).toBe(true);
    expect(reader.hasBufferedEvents()).toBe(true);
    await expect(reader.return('stop')).resolves.toEqual({ value: text('closed'), done: true });
    expect(returnedValue).toBe('stop');
    expect(reader.hasBufferedEvents()).toBe(false);
  });

  it('returns a done result when the wrapped source has no return hook', async () => {
    const source = {
      async next() {
        return { value: text('pending'), done: false } as IteratorResult<AnyXmlEvent>;
      }
    };

    const reader = new AsyncEventBatchIterator(source);
    const returnValue = text('manual');

    await expect(reader.return(returnValue)).resolves.toEqual({
      value: returnValue,
      done: true
    });
  });

  it('normalizes and detects async event iterators', () => {
    class AsyncNamedSource implements AsyncIterator<AnyXmlEvent> {
      async next(): Promise<IteratorResult<AnyXmlEvent>> {
        return { value: undefined, done: true };
      }
    }

    const existing = new AsyncEventBatchIterator(asyncEvents([]));
    const asyncIterable = asyncEvents([]);
    const syncIterator = [text('sync')][Symbol.iterator]();

    expect(asAsyncEventBatchIterator(existing)).toBe(existing);
    expect(asAsyncEventBatchIterator(asyncIterable)).toBeInstanceOf(AsyncEventBatchIterator);
    expect(isAsyncEventIterator(existing)).toBe(true);
    expect(isAsyncEventIterator(asyncIterable)).toBe(true);
    expect(isAsyncEventIterator(new AsyncNamedSource())).toBe(true);
    expect(isAsyncEventIterator(syncIterator)).toBe(false);
    expect(isAsyncEventIterator(Object.create(null))).toBe(false);
  });
});
