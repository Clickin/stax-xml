import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const assetsDir = join(__dirname, 'assets');
const resultsDir = join(__dirname, 'results', 'async-fast-path-poc');

const QUICK_WARMUPS = 1;
const QUICK_RUNS = 3;
const FULL_WARMUPS = 2;
const FULL_RUNS = 6;

type ScenarioResult = {
  id: string;
  avgMs: number;
  minMs: number;
  maxMs: number;
  checksum: number;
  samplesMs: number[];
};

type FixtureReport = {
  fixture: string;
  scenarios: ScenarioResult[];
};

function parseCliArgs(argv: string[]) {
  return {
    quick: argv.includes('--quick'),
  };
}

function getRunCounts(quick: boolean) {
  return quick
    ? { warmups: QUICK_WARMUPS, runs: QUICK_RUNS }
    : { warmups: FULL_WARMUPS, runs: FULL_RUNS };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mixChecksum(seed: number, value: number) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed: number, value: string | undefined) {
  if (!value) {
    return seed;
  }

  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function consumeEvent(event: any) {
  let checksum = 0;
  checksum = foldString(checksum, event.type);
  checksum = foldString(checksum, event.name);
  checksum = foldString(checksum, event.localName);
  checksum = foldString(checksum, event.prefix);
  checksum = foldString(checksum, event.uri);
  checksum = foldString(checksum, event.value);

  if (event.type === 'START_ELEMENT' && event.attributes) {
    const entries = Object.entries(event.attributes as Record<string, string>);
    checksum = mixChecksum(checksum, entries.length);
    for (const [name, value] of entries) {
      checksum = foldString(checksum, name);
      checksum = foldString(checksum, value);
    }
  }

  return checksum;
}

function createWebStream(fixturePath: string): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(fixturePath)) as ReadableStream<Uint8Array>;
}

async function measure(
  createParser: () => AsyncIterable<any>,
  warmups: number,
  runs: number,
): Promise<ScenarioResult> {
  for (let index = 0; index < warmups; index++) {
    for await (const _event of createParser()) {
      // warmup
    }
  }

  const samplesMs: number[] = [];
  let checksum = 0;
  for (let index = 0; index < runs; index++) {
    const startedAt = performance.now();
    let sampleChecksum = 0;
    for await (const event of createParser()) {
      sampleChecksum ^= consumeEvent(event);
    }
    samplesMs.push(performance.now() - startedAt);
    checksum = mixChecksum(checksum, sampleChecksum);
  }

  return {
    id: '',
    avgMs: average(samplesMs),
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    checksum,
    samplesMs,
  };
}

async function loadPublishedModule() {
  const candidates = [
    resolve(__dirname, '..', '..', 'node_modules', '.pnpm', 'node_modules', 'stax-xml-published', 'dist', 'index.js'),
    resolve(__dirname, '..', '..', 'node_modules', 'stax-xml-published', 'dist', 'index.js'),
    resolve(__dirname, '..', '..', '..', 'node_modules', '.pnpm', 'node_modules', 'stax-xml-published', 'dist', 'index.js'),
    resolve(__dirname, '..', '..', '..', 'node_modules', 'stax-xml-published', 'dist', 'index.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return import(pathToFileURL(candidate).href);
    }
  }

  throw new Error('Missing published stax-xml alias at node_modules/.pnpm/node_modules/stax-xml-published');
}

function formatMs(value: number) {
  return value.toFixed(2);
}

function formatPct(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

async function main(argv = process.argv.slice(2)) {
  const { quick } = parseCliArgs(argv);
  const runCounts = getRunCounts(quick);

  const current = await import('../stax-xml/src/index.ts');
  const published = await loadPublishedModule();

  const fixtures = ['complex.xml', 'midsize.xml']
    .map((name) => ({
      name,
      path: join(assetsDir, name),
    }))
    .filter((fixture) => existsSync(fixture.path));

  const fixtureReports: FixtureReport[] = [];

  for (const fixture of fixtures) {
    const scenarios: ScenarioResult[] = [];

    const currentResult = await measure(
      () => new current.StaxXmlParser(createWebStream(fixture.path)),
      runCounts.warmups,
      runCounts.runs,
    );
    currentResult.id = 'current';
    scenarios.push(currentResult);

    const experimentalResult = await measure(
      () => new current.StaxXmlParserFastPathExperimental(createWebStream(fixture.path)),
      runCounts.warmups,
      runCounts.runs,
    );
    experimentalResult.id = 'experimental';
    scenarios.push(experimentalResult);

    const publishedResult = await measure(
      () => new published.StaxXmlParser(createWebStream(fixture.path)),
      runCounts.warmups,
      runCounts.runs,
    );
    publishedResult.id = 'published-v0.5.2';
    scenarios.push(publishedResult);

    fixtureReports.push({
      fixture: fixture.name,
      scenarios,
    });
  }

  mkdirSync(resultsDir, { recursive: true });
  const stamp = Date.now();
  const jsonPath = resolve(resultsDir, `async-fast-path-poc-${stamp}.json`);
  const mdPath = resolve(resultsDir, `async-fast-path-poc-${stamp}.md`);

  const jsonReport = {
    generatedAt: new Date().toISOString(),
    quick,
    runCounts,
    fixtures: fixtureReports,
  };
  writeFileSync(jsonPath, `${JSON.stringify(jsonReport, null, 2)}\n`, 'utf8');

  const lines: string[] = [];
  lines.push('# Async Fast-Path PoC');
  lines.push('');
  lines.push(`Generated: ${jsonReport.generatedAt}`);
  lines.push(`Warmup runs: ${runCounts.warmups}`);
  lines.push(`Measurement runs: ${runCounts.runs}`);

  for (const fixture of fixtureReports) {
    const publishedResult = fixture.scenarios.find((entry) => entry.id === 'published-v0.5.2');
    lines.push('');
    lines.push(`## ${fixture.fixture}`);
    lines.push('');
    lines.push('| Scenario | Avg ms | Min ms | Max ms | Checksum | Delta vs published |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');

    for (const scenario of fixture.scenarios) {
      const delta = publishedResult
        ? ((scenario.avgMs - publishedResult.avgMs) / publishedResult.avgMs) * 100
        : 0;
      lines.push(`| ${scenario.id} | ${formatMs(scenario.avgMs)} | ${formatMs(scenario.minMs)} | ${formatMs(scenario.maxMs)} | ${scenario.checksum} | ${formatPct(delta)} |`);
    }
  }

  writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

void main();
