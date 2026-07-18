import { closeSync, mkdtempSync, openSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { WriterSyncSink } from 'stax-xml';

const MIB = 1024 * 1024;
const root = resolve(import.meta.dirname);
const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const [key, value] = process.argv[i].split('=');
  args.set(key, value ?? process.argv[++i]);
}
const records = Number(args.get('--records') ?? 12798);
const runs = Number(args.get('--runs') ?? 3);
const jsonOut = args.get('--json-out');
const temp = mkdtempSync(join(tmpdir(), 'stax-xml-writer-cross-runtime-'));
const description = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

function writeBook(writer, bookId) {
  writer.writeStartElement('book', { attributes: { id: `book-${bookId}` } });
  const element = (name, value) => { writer.writeStartElement(name); writer.writeCharacters(value); writer.writeEndElement(); };
  element('title', `Sample Book Title Number ${bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
  element('author', `Author Name ${bookId}`);
  element('isbn', `978${100000000 + ((bookId * 48271) % 900000000)}`);
  element('publisher', `Sample Publisher ${bookId}`);
  element('publishDate', `${2020 + bookId % 5}-${String(bookId % 12 + 1).padStart(2, '0')}-${String(bookId % 28 + 1).padStart(2, '0')}`);
  element('description', description);
  writer.writeStartElement('chapters');
  for (const [index, name] of ['Introduction', 'Main Content', 'Conclusion'].entries()) {
    writer.writeStartElement('chapter', { attributes: { number: String(index + 1) } });
    writer.writeCharacters(`${name} Chapter for Book ${bookId}`);
    writer.writeEndElement();
  }
  writer.writeEndElement();
  writer.writeEndElement();
}

function runStax() {
  const path = join(temp, 'stax.xml');
  const fd = openSync(path, 'w');
  const writer = new WriterSyncSink({ write: chunk => writeSync(fd, chunk, undefined, 'utf8'), close: () => closeSync(fd) }, { bufferSize: 64 * 1024, flushThreshold: 0.8 });
  const started = performance.now();
  writer.writeStartDocument('1.0', 'utf-8');
  writer.writeStartElement('books');
  for (let bookId = 1; bookId <= records; bookId++) writeBook(writer, bookId);
  writer.writeEndElement();
  writer.writeEndDocument();
  writer.close();
  const seconds = (performance.now() - started) / 1000;
  const bytes = statSync(path).size;
  return { records, bytes, seconds, throughputMiBs: bytes / MIB / seconds };
}

function runExternal(kind) {
  const path = join(temp, `${kind}.xml`);
  if (kind === 'woodstox') {
    const java = join(temp, 'XmlWriterBench.java');
    execFileSync('cp', [join(root, 'cross-runtime/writer-woodstox/XmlWriterBench.java'), java]);
    const woodstox = join(process.env.HOME, '.m2/repository/com/fasterxml/woodstox/woodstox-core/6.7.0/woodstox-core-6.7.0.jar');
    const stax2 = join(process.env.HOME, '.m2/repository/org/codehaus/woodstox/stax2-api/4.2.2/stax2-api-4.2.2.jar');
    execFileSync('javac', ['-cp', `${woodstox}:${stax2}`, java]);
    return JSON.parse(execFileSync('java', ['-cp', `${temp}:${woodstox}:${stax2}`, 'XmlWriterBench', String(records), path], { encoding: 'utf8' }));
  }
  const manifest = join(root, 'cross-runtime/writer-quickxml/Cargo.toml');
  const output = execFileSync('cargo', ['run', '--release', '--offline', '--manifest-path', manifest, '--', String(records), path], {
    encoding: 'utf8',
    env: { ...process.env, CARGO_TARGET_DIR: join(temp, 'cargo-target') },
  });
  return JSON.parse(output.trim().split('\n').at(-1));
}

const cases = {};
for (const name of ['stax-xml', 'woodstox', 'quick-xml']) {
  const values = [];
  for (let run = 0; run < runs; run++) values.push(name === 'stax-xml' ? runStax() : runExternal(name));
  cases[name] = values;
}
const result = {
  generatedAt: new Date().toISOString(),
  workload: { records, outputBytes: cases['stax-xml'][0].bytes, compact: true, generator: 'writer-cross-runtime.mjs' },
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: process.report?.getReport?.().header?.cpus?.[0]?.model ?? 'unknown',
    java: '25.0.2',
    woodstox: '6.7.0',
    rust: '1.95.0',
    quickXml: '0.40.1',
  },
  cases,
};
console.log(JSON.stringify(result, null, 2));
if (jsonOut) writeFileSync(resolve(jsonOut), `${JSON.stringify(result, null, 2)}\n`);
rmSync(temp, { recursive: true, force: true });
