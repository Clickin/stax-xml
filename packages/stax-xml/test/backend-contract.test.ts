import { expect, it } from 'vitest';
import { JsTokenCursor as TokenCursor } from '../src/core/js/JsTokenCursor.js';
import { StreamReaderSync } from '../src/sync/StreamReaderSync.js';
import { x } from '../src/converter/converter/index.js';
import {
  jsTokenBackendFactory,
  tokenBackendFactorySymbol,
  withTokenBackend,
  type TokenBackendFactory,
} from '../src/experimental/backend.js';
import { runBackendContract, runDifferentialFuzz } from './backend-contract.js';

it('preserves the token contract across UTF-8 byte boundaries', () => {
  runBackendContract(jsTokenBackendFactory);
  runDifferentialFuzz(jsTokenBackendFactory);
});

it('distinguishes missing attributes from raw values and namespace matches', () => {
  const xml = '<r xmlns:p="urn:p" plain="&amp;" p:code="y"/>';
  const options = { namespaceAware: true, autoDecodeEntities: false };
  const cursor = new TokenCursor(xml, true, options);
  cursor.next();
  cursor.next();
  expect(cursor.attribute('', 'plain')?.value).toBe('&amp;');
  expect(cursor.attribute('urn:p', 'code')?.value).toBe('y');
  expect(cursor.attribute('urn:absent', 'code')).toBeUndefined();
  expect(cursor.attribute('urn:p', 'missing')).toBeUndefined();
  const missing = cursor.attributeCount();
  expect(cursor.attributeName(missing)).toBeUndefined();
  expect(cursor.attributePrefix(missing)).toBeUndefined();
  expect(cursor.attributeNamespaceURI(missing)).toBeUndefined();
  cursor.dispose();

  const reader = new StreamReaderSync(xml, options);
  reader.next();
  reader.next();
  expect(reader.attributeValue('urn:p', 'missing')).toBeUndefined();
  reader.close();
});

it('rejects malformed backend extensions but honors a complete backend', () => {
  const parser = x.string('/r');
  for (const backend of [
    1,
    {},
    { createStringCursor: jsTokenBackendFactory.createStringCursor },
  ]) {
    const options = {
      encoding: 'utf-8',
      [tokenBackendFactorySymbol]: backend,
    };
    expect(() => parser.parseSync('<r>JS</r>', options)).toThrow(/version 2/i);
  }
  const backend: TokenBackendFactory = {
    ...jsTokenBackendFactory,
    createStringCursor(input, options) {
      return jsTokenBackendFactory.createStringCursor(input, {
        ...options,
        addEntities: [{ entity: 'selected', value: 'backend' }],
      });
    },
  };
  expect(parser.parseSync(
    '<r>&selected;</r>',
    withTokenBackend({}, backend),
  )).toBe('backend');
});

it('preserves primary failures and surfaces cleanup failures after success', async () => {
  const cleanupFailure = new Error('cleanup failed');
  const backend: TokenBackendFactory = {
    ...jsTokenBackendFactory,
    createByteSession(options) {
      const session = jsTokenBackendFactory.createByteSession(options);
      const dispose = session.dispose.bind(session);
      session.dispose = () => {
        dispose();
        throw cleanupFailure;
      };
      return session;
    },
  };
  const options = withTokenBackend({}, backend);
  const parser = x.string('/r');
  await expect(parser.parse(
    new Uint8Array([0xff]),
    options,
  )).rejects.toBeInstanceOf(TypeError);
  await expect(parser.parse(
    new TextEncoder().encode('<r>ok</r>'),
    options,
  )).rejects.toBe(cleanupFailure);

  const stream = new ReadableStream<Uint8Array>();
  const lock = stream.getReader();
  try {
    await expect(parser.parse(stream, options)).rejects.toBeInstanceOf(TypeError);
  } finally {
    lock.releaseLock();
  }
});
