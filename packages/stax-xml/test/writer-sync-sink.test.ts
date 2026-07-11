import { closeSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { WriterSyncSink, type SyncTextSink } from 'stax-xml-sync';
import { CursorReaderSync, StreamEventType } from 'stax-xml-sync';
import { bunFileByteBatchesSync, createBunSyncTextSink } from '../src/adapters/bun';
import { createNodeFileSyncTextSink, createNodeSyncTextSink, nodeFileByteBatchesSync } from '../src/adapters/node';
import { createDenoSyncTextSink, denoFileByteBatchesSync } from '../src/adapters/deno';
import { x } from 'stax-xml-converter';

function createMemorySink(): SyncTextSink & {
  chunks: string[];
  flushCalls: number;
  closeCalls: number;
} {
  const chunks: string[] = [];

  return {
    chunks,
    flushCalls: 0,
    closeCalls: 0,
    write(chunk: string) {
      chunks.push(chunk);
    },
    flush() {
      this.flushCalls += 1;
    },
    close() {
      this.closeCalls += 1;
    }
  };
}

describe('WriterSyncSink', () => {
  it('should flush buffered output into the sink and call sink.flush()', () => {
    const sink = createMemorySink();
    const writer = new WriterSyncSink(sink, {
      enableAutoFlush: false
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeCharacters('value');

    expect(sink.chunks).toEqual([]);

    writer.flush();

    expect(sink.chunks.join('')).toContain('<root>value');
    expect(sink.flushCalls).toBe(1);
  });

  it('should auto flush internal buffers without calling sink.flush()', () => {
    const sink = createMemorySink();
    const writer = new WriterSyncSink(sink, {
      bufferSize: 12,
      flushThreshold: 6,
      enableAutoFlush: true
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeCharacters('A'.repeat(64));
    writer.writeEndElement();
    writer.writeEndDocument();

    expect(sink.chunks.join('')).toContain(`<root>${'A'.repeat(64)}</root>`);
    expect(sink.chunks.length).toBeGreaterThan(1);
    expect(sink.flushCalls).toBe(0);
  });

  it('should finalize open elements and mark the writer closed on close()', () => {
    const sink = createMemorySink();
    const writer = new WriterSyncSink(sink, {
      flushOnClose: true
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeStartElement('child');
    writer.writeCharacters('value');

    writer.close();

    expect(sink.chunks.join('')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><root><child>value</child></root>'
    );
    expect(sink.flushCalls).toBe(1);
    expect(sink.closeCalls).toBe(1);
    expect(() => writer.writeStartElement('after-close')).toThrow(
      'Cannot writeStartElement: Writer is closed or in error state.'
    );
  });

  it('should flush the sink from writeEndDocument() when flushOnClose is enabled', () => {
    const sink = createMemorySink();
    const writer = new WriterSyncSink(sink, {
      flushOnClose: true
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeCharacters('done');
    writer.writeEndElement();
    writer.writeEndDocument();

    expect(sink.chunks.join('')).toContain('<root>done</root>');
    expect(sink.flushCalls).toBe(1);
    expect(sink.closeCalls).toBe(0);
  });

  it('should support writeSync() with an injected sink writer and return an empty string', () => {
    const sink = createMemorySink();
    const writer = new WriterSyncSink(sink);
    const schema = x.object({
      title: x.string().xpath('/book/title').writer({ element: 'title' }),
      price: x.number().xpath('/book/price').writer({ element: 'price' })
    });

    const result = schema.writeSync(
      {
        title: 'High-Performance XML',
        price: 12345
      },
      {
        rootElement: 'book',
        writer
      }
    );

    writer.close();

    expect(result).toBe('');
    expect(sink.chunks.join('')).toContain('<book>');
    expect(sink.chunks.join('')).toContain('<title>High-Performance XML</title>');
    expect(sink.chunks.join('')).toContain('<price>12345</price>');
  });
});

describe('sync sink adapters', () => {
  it('should adapt node writable-like targets with flush and close', () => {
    const writes: string[] = [];
    const target = {
      flushed: 0,
      closed: 0,
      write(chunk: string) {
        writes.push(chunk);
      },
      flush() {
        this.flushed += 1;
      },
      close() {
        this.closed += 1;
      }
    };

    const sink = createNodeSyncTextSink(target, { closeMethod: 'close' });
    sink.write('<root/>');
    sink.flush?.();
    sink.close?.();

    expect(writes).toEqual(['<root/>']);
    expect(target.flushed).toBe(1);
    expect(target.closed).toBe(1);
  });

  it('should support node close fallbacks and file-sink closeOnExit=false', () => {
    const destroyTarget = {
      destroyed: 0,
      write() {},
      destroy() {
        this.destroyed += 1;
      }
    };

    createNodeSyncTextSink(destroyTarget, { closeMethod: 'destroy' }).close?.();
    expect(destroyTarget.destroyed).toBe(1);

    const endTarget = {
      ended: 0,
      write() {},
      end() {
        this.ended += 1;
      }
    };

    createNodeSyncTextSink(endTarget).close?.();
    expect(endTarget.ended).toBe(1);

    const tempDir = mkdtempSync(join(tmpdir(), 'stax-xml-node-fd-'));
    const filePath = join(tempDir, 'keep-open.xml');
    const fd = openSync(filePath, 'w');
    const sink = createNodeFileSyncTextSink(fd, { closeOnExit: false });

    try {
      sink.write('<open/>');
      sink.close?.();
      expect(readFileSync(filePath, 'utf8')).toBe('<open/>');
    } finally {
      closeSync(fd);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should write to a node file descriptor synchronously', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'stax-xml-sync-sink-'));
    const filePath = join(tempDir, 'catalog.xml');
    const fd = openSync(filePath, 'w');
    const sink = createNodeFileSyncTextSink(fd);

    try {
      const writer = new WriterSyncSink(sink);
      writer.writeStartDocument();
      writer.writeStartElement('catalog');
      writer.writeCharacters('sync');
      writer.writeEndElement();
      writer.close();

      expect(readFileSync(filePath, 'utf8')).toBe(
        '<?xml version="1.0" encoding="UTF-8"?><catalog>sync</catalog>'
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should expose node file byte batches as CursorReaderSync input', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'stax-xml-node-byte-batches-'));
    const filePath = join(tempDir, 'catalog.xml');
    const xml = '<catalog><book id="b1">StAX</book><book id="b2">XML</book></catalog>';
    writeFileSync(filePath, xml);

    try {
      const batches = Array.from(nodeFileByteBatchesSync(filePath, { chunkSize: 9, batchSize: 2 }));
      const flattened = Buffer.concat(batches.flatMap((batch) => [...batch]));
      expect(flattened.toString('utf8')).toBe(xml);
      expect(batches.every((batch) => batch.length <= 2)).toBe(true);

      const reader = new CursorReaderSync(nodeFileByteBatchesSync(filePath, { chunkSize: 9, batchSize: 2 }));
      const books: string[] = [];
      while (reader.next()) {
        if (reader.eventType() === StreamEventType.CHARACTERS) {
          books.push(reader.text() ?? '');
        }
      }

      expect(books).toEqual(['StAX', 'XML']);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should reject invalid node file byte batch options', () => {
    expect(() => Array.from(nodeFileByteBatchesSync('/tmp/missing.xml', { chunkSize: 0 }))).toThrow(
      'chunkSize must be a positive integer.'
    );
    expect(() => Array.from(nodeFileByteBatchesSync('/tmp/missing.xml', { batchSize: 1.5 }))).toThrow(
      'batchSize must be a positive integer.'
    );
  });

  it('should adapt bun targets with flush and close fallbacks', () => {
    const writes: string[] = [];
    const closeTarget = {
      flushed: 0,
      closed: 0,
      write(data: string) {
        writes.push(data);
      },
      flush() {
        this.flushed += 1;
      },
      close() {
        this.closed += 1;
      }
    };

    const closeSink = createBunSyncTextSink(closeTarget, { closeMethod: 'close' });
    closeSink.write('<bun-close/>');
    closeSink.flush?.();
    closeSink.close?.();

    expect(writes).toContain('<bun-close/>');
    expect(closeTarget.flushed).toBe(1);
    expect(closeTarget.closed).toBe(1);

    const endTarget = {
      ended: 0,
      write() {},
      end() {
        this.ended += 1;
      }
    };

    createBunSyncTextSink(endTarget).close?.();
    expect(endTarget.ended).toBe(1);
  });

  it('should expose bun file byte batches as CursorReaderSync input', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'stax-xml-bun-byte-batches-'));
    const filePath = join(tempDir, 'catalog.xml');
    writeFileSync(filePath, '<catalog><book>Bun</book></catalog>');

    try {
      const reader = new CursorReaderSync(bunFileByteBatchesSync(filePath, { chunkSize: 5, batchSize: 2 }));
      const text: string[] = [];
      while (reader.next()) {
        if (reader.eventType() === StreamEventType.CHARACTERS) {
          text.push(reader.text() ?? '');
        }
      }

      expect(text).toEqual(['Bun']);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should adapt deno sync targets and reject async-only targets', () => {
    const textWrites: string[] = [];
    const textSink = createDenoSyncTextSink({
      writeTextSync(text: string) {
        textWrites.push(text);
      }
    });

    textSink.write('<text/>');
    expect(textWrites).toEqual(['<text/>']);

    const byteWrites: Uint8Array[] = [];
    const byteSink = createDenoSyncTextSink({
      writeSync(chunk: Uint8Array) {
        byteWrites.push(chunk);
        return chunk.length;
      }
    });

    byteSink.write('<bytes/>');
    expect(new TextDecoder().decode(byteWrites[0])).toBe('<bytes/>');

    let flushSyncCalls = 0;
    let closeCalls = 0;
    const lifecycleSink = createDenoSyncTextSink({
      writeTextSync() {},
      flushSync() {
        flushSyncCalls += 1;
      },
      close() {
        closeCalls += 1;
      }
    });

    lifecycleSink.flush?.();
    lifecycleSink.close?.();

    expect(flushSyncCalls).toBe(1);
    expect(closeCalls).toBe(1);

    let flushCalls = 0;
    createDenoSyncTextSink({
      writeTextSync() {},
      flush() {
        flushCalls += 1;
      }
    }).flush?.();

    expect(flushCalls).toBe(1);

    const asyncOnlyTarget = {
      write() {
        return Promise.resolve(1);
      }
    };

    expect(() => createDenoSyncTextSink(asyncOnlyTarget as never).write('<bad/>')).toThrow(
      'Unsupported Deno sink: provide writeTextSync or writeSync'
    );
  });

  it('should expose deno file byte batches as CursorReaderSync input', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'stax-xml-deno-byte-batches-'));
    const filePath = join(tempDir, 'catalog.xml');
    writeFileSync(filePath, '<catalog><book>Deno</book></catalog>');
    const previousDeno = (globalThis as { Deno?: unknown }).Deno;

    (globalThis as { Deno?: unknown }).Deno = {
      openSync(path: string | URL) {
        const fd = openSync(path, 'r');
        return {
          readSync(buffer: Uint8Array) {
            const bytesRead = readSync(fd, buffer, 0, buffer.byteLength, null);
            return bytesRead === 0 ? null : bytesRead;
          },
          close() {
            closeSync(fd);
          }
        };
      }
    };

    try {
      const reader = new CursorReaderSync(denoFileByteBatchesSync(filePath, { chunkSize: 5, batchSize: 2 }));
      const text: string[] = [];
      while (reader.next()) {
        if (reader.eventType() === StreamEventType.CHARACTERS) {
          text.push(reader.text() ?? '');
        }
      }

      expect(text).toEqual(['Deno']);
    } finally {
      if (previousDeno === undefined) {
        delete (globalThis as { Deno?: unknown }).Deno;
      } else {
        (globalThis as { Deno?: unknown }).Deno = previousDeno;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
