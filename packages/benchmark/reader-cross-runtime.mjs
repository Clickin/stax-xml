import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { StreamReaderSync, XmlEventType } from 'stax-xml';

const root = dirname(fileURLToPath(import.meta.url));
const MIB = 1024 * 1024;
const args = new Map();
for (let index = 2; index < process.argv.length; index++) {
  if (process.argv[index] === '--') continue;
  const [key, value] = process.argv[index].split('=');
  args.set(key, value ?? process.argv[++index]);
}
const file = resolve(args.get('--file') ?? join(root, 'test-data/runtime-comparison-16mib.xml'));
const runs = Number(args.get('--runs') ?? 3);
const warmups = Number(args.get('--warmups') ?? 1);
const jsonOut = resolve(args.get('--json-out') ?? join(root, 'results/release/reader-cross-runtime.json'));
const mdOut = resolve(args.get('--md-out') ?? join(root, 'results/release/reader-cross-runtime.md'));
const temp = mkdtempSync(join(tmpdir(), 'stax-xml-reader-cross-runtime-'));

function fold(seed, value) {
  let next = seed;
  for (let index = 0; index < value.length; index++) next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  return next;
}

function mix(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function consumeStax(bytes) {
  const reader = new StreamReaderSync(bytes, { documentMode: 'document' });
  let events = 0;
  let checksum = 0;
  let pendingText = '';
  const flushText = () => {
    const text = pendingText.trim();
    pendingText = '';
    if (!text) return;
    events++;
    checksum = fold(fold(checksum, 'T'), text);
  };
  while (reader.next() !== null) {
    const type = reader.eventType();
    if (type === XmlEventType.START_ELEMENT) {
      flushText();
      events++;
      checksum = fold(fold(checksum, 'S'), reader.name());
      const count = reader.attributeCount();
      checksum = mix(checksum, count);
      for (let index = 0; index < count; index++) {
        checksum = fold(checksum, reader.attributeName(index));
        checksum = fold(checksum, reader.attributeValue(index));
      }
    } else if (type === XmlEventType.END_ELEMENT) {
      flushText();
      events++;
      checksum = fold(fold(checksum, 'E'), reader.name());
    } else if (type === XmlEventType.CHARACTERS || type === XmlEventType.CDATA) {
      pendingText += reader.text();
    }
  }
  flushText();
  return { events, checksum };
}

function measureStax(bytes) {
  for (let index = 0; index < warmups; index++) consumeStax(bytes);
  const values = [];
  for (let index = 0; index < runs; index++) {
    const started = performance.now();
    const result = consumeStax(bytes);
    values.push({ ...result, seconds: (performance.now() - started) / 1000 });
  }
  return values;
}

function toolVersion(command, commandArgs) {
  const line = execFileSync(command, commandArgs, { encoding: 'utf8' }).trim().split('\n')[0];
  return line.match(/\d+(?:\.\d+)+/)?.[0] ?? line;
}

function runJava() {
  const woodstox = join(process.env.HOME, '.m2/repository/com/fasterxml/woodstox/woodstox-core/6.7.0/woodstox-core-6.7.0.jar');
  const stax2 = join(process.env.HOME, '.m2/repository/org/codehaus/woodstox/stax2-api/4.2.2/stax2-api-4.2.2.jar');
  const classpath = `${temp}:${woodstox}:${stax2}`;
  const source = join(root, 'cross-runtime/reader-woodstox/XmlReaderBench.java');
  execFileSync('javac', ['-cp', `${woodstox}:${stax2}`, '-d', temp, source]);
  return JSON.parse(execFileSync('java', ['-cp', classpath, 'XmlReaderBench', file, String(warmups), String(runs)], { encoding: 'utf8' }));
}

function runRust() {
  const manifest = join(root, 'cross-runtime/reader-quickxml/Cargo.toml');
  const output = execFileSync('cargo', ['run', '--release', '--offline', '--manifest-path', manifest, '--', file, String(warmups), String(runs)], {
    encoding: 'utf8',
    env: { ...process.env, CARGO_TARGET_DIR: join(temp, 'cargo-target') },
  });
  return JSON.parse(output.trim().split('\n').at(-1));
}

function rows(report) {
  return Object.entries(report.cases).map(([name, values]) => {
    const sorted = [...values].sort((left, right) => left.seconds - right.seconds);
    const value = sorted[Math.floor(sorted.length / 2)];
    return `| ${name} | ${(report.fixture.sizeBytes / MIB / value.seconds).toFixed(1)} MiB/s | ${(value.seconds * 1000).toFixed(2)} ms | ${value.events} | ${value.checksum} |`;
  });
}

function markdown(report) {
  return `# Cross-Language Reader Benchmark\n\nGenerated: ${report.generatedAt}\n\nThe same in-memory UTF-8 XML fixture is parsed through public pull-reader APIs after file I/O. Start/end elements, non-whitespace text, and every attribute name/value are materialized and folded into the same checksum.\n\n| Reader | Median throughput | Median time | Events | Checksum |\n| --- | ---: | ---: | ---: | ---: |\n${rows(report).join('\n')}\n`;
}

try {
  const bytes = readFileSync(file);
  const external = { woodstox: runJava(), 'quick-xml': runRust() };
  const cases = {
    'stax-xml': measureStax(bytes),
    woodstox: external.woodstox.samples,
    'quick-xml': external['quick-xml'].samples,
  };
  const expected = cases['stax-xml'][0];
  for (const [name, values] of Object.entries(cases)) {
    for (const value of values) {
      if (value.events !== expected.events || value.checksum !== expected.checksum) {
        throw new Error(`${name} produced different reader output: events=${value.events}, checksum=${value.checksum}`);
      }
      value.throughputMiBs = bytes.byteLength / MIB / value.seconds;
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    fixture: { path: file, sizeBytes: statSync(file).size, contract: 'full pull-reader materialization after file I/O' },
    options: { warmups, runs },
    environment: {
      node: process.version,
      java: toolVersion('java', ['--version']),
      woodstox: '6.7.0',
      rust: toolVersion('rustc', ['--version']),
      quickXml: '0.40.1',
    },
    cases,
  };
  writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdOut, markdown(report));
  console.log(`Wrote ${jsonOut}`);
  console.log(`Wrote ${mdOut}`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
