import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const woodstoxSource = join(__dirname, 'external', 'woodstox', 'src', 'main', 'java', 'com', 'staxxml', 'benchmark', 'WoodstoxBench.java');
const quickXmlSource = join(__dirname, 'external', 'quick-xml', 'src', 'main.rs');
const externalBaselineSource = join(__dirname, 'external-baseline.mjs');
const proofLedgerSource = join(repoRoot, 'docs', 'plans', '2026-05-23-stax-api-performance-proof-ledger.md');
const defaultExternalBaseline = join(__dirname, 'results', 'release', 'external-baseline.json');
const defaultJsonOut = join(__dirname, 'results', 'release', 'materialization-contract-audit.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'materialization-contract-audit.md');

const semanticFields = [
  'event type',
  'element local name',
  'attribute count',
  'attribute local name',
  'attribute value',
  'trimmed non-empty text',
  'trimmed non-empty CDATA',
  'UTF-16-code-unit checksum',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    externalBaseline: defaultExternalBaseline,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    if (arg === '--self-test') {
      options.selfTest = true;
      continue;
    }

    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--external-baseline':
        options.externalBaseline = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport() : createReport(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`Wrote ${options.jsonOut}`);
  console.log(`Wrote ${options.mdOut}`);
}

function createSelfTestReport() {
  return buildReport({
    generatedAt: 'self-test',
    environment: {
      cpuName: 'self-test',
      platform: 'self-test',
      node: 'self-test',
      v8: 'self-test',
    },
    sources: {
      woodstox: `
XMLStreamReader reader = factory.createXMLStreamReader(input, "UTF-8");
int eventType = reader.getEventType();
checksum = foldString(checksum, reader.getLocalName());
int attrCount = reader.getAttributeCount();
checksum = foldString(checksum, reader.getAttributeLocalName(attrIndex));
checksum = foldString(checksum, reader.getAttributeValue(attrIndex));
String text = reader.getText().trim();
`,
      quickXml: `
match reader.read_event_into(&mut buffer)? {
  Event::Start(event) => {
    checksum = fold_bytes(checksum, event.name().as_ref())?;
    checksum = fold_bytes(checksum, attr.key.as_ref())?;
    checksum = fold_bytes(checksum, attr.value.as_ref())?;
  }
  Event::Text(event) => {
    let text = event.decode()?;
    checksum = fold_text_event(checksum, &text, 4, &mut event_count);
  }
}
buffer.clear();
for unit in value.encode_utf16() {}
`,
      externalBaseline: `
for (const event of new EventReaderSync(xml)) {
  checksum = foldString(checksum, event.name);
  for (const [name, value] of Object.entries(event.attributes)) {}
}
for (const batch of new StreamReaderSync(bytes)) {
  checksum = foldString(checksum, batch.nameAt(index));
  checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
}
`,
      proofLedger: 'CLAIM-LAZY-GETTERS | Lazy event getters are not a current optimization candidate. | NEGATIVE_RESULT |',
    },
    baseline: createSelfTestBaseline(),
    metadata: {
      woodstoxSource: 'self-test/WoodstoxBench.java',
      quickXmlSource: 'self-test/main.rs',
      externalBaselineSource: 'self-test/external-baseline.mjs',
      proofLedgerSource: 'self-test/proof-ledger.md',
      externalBaselineReport: 'self-test/external-baseline.json',
    },
  });
}

function createReport(options) {
  return buildReport({
    generatedAt: new Date().toISOString(),
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      v8: process.versions.v8,
    },
    sources: {
      woodstox: readRequiredFile(woodstoxSource),
      quickXml: readRequiredFile(quickXmlSource),
      externalBaseline: readRequiredFile(externalBaselineSource),
      proofLedger: readRequiredFile(proofLedgerSource),
    },
    baseline: readExternalBaseline(options.externalBaseline),
    metadata: {
      woodstoxSource,
      quickXmlSource,
      externalBaselineSource,
      proofLedgerSource,
      externalBaselineReport: options.externalBaseline,
    },
  });
}

function buildReport({ generatedAt, environment, sources, baseline, metadata }) {
  const sourceChecks = createSourceChecks(sources);
  const consumers = createConsumers(sourceChecks, baseline);
  const parity = createParity(consumers);
  return {
    generatedAt,
    objective: 'materialization-contract-audit',
    contract: 'semantic-materialization-not-object-shape',
    note: 'Audits the comparator boundary: rows share semantic fields and checksum parity, but not language/runtime object shape.',
    environment,
    metadata,
    baseline: {
      source: baseline.source,
      generatedAt: baseline.generatedAt,
      fixture: baseline.fixture,
      options: baseline.options,
    },
    semanticFields,
    sourceChecks,
    parity,
    consumers,
    findings: createFindings(consumers, parity, sourceChecks),
  };
}

function createSourceChecks(sources) {
  const checks = [
    {
      id: 'woodstox-cursor-getters',
      supported: /XMLStreamReader/.test(sources.woodstox)
        && /reader\.getEventType\(\)/.test(sources.woodstox)
        && /reader\.getLocalName\(\)/.test(sources.woodstox)
        && /reader\.getAttributeCount\(\)/.test(sources.woodstox)
        && /reader\.getAttributeLocalName\(attrIndex\)/.test(sources.woodstox)
        && /reader\.getAttributeValue\(attrIndex\)/.test(sources.woodstox)
        && /reader\.getText\(\)\.trim\(\)/.test(sources.woodstox),
      evidence: [
        'XMLStreamReader',
        'reader.getEventType()',
        'reader.getLocalName()',
        'reader.getAttributeLocalName(attrIndex)',
        'reader.getAttributeValue(attrIndex)',
        'reader.getText().trim()',
      ],
    },
    {
      id: 'quick-xml-buffered-enum-events',
      supported: /read_event_into\(&mut buffer\)/.test(sources.quickXml)
        && /Event::Start\(event\)/.test(sources.quickXml)
        && /Event::Text\(event\)/.test(sources.quickXml)
        && /event\.decode\(\)\?/.test(sources.quickXml)
        && /event\.name\(\)\.as_ref\(\)/.test(sources.quickXml)
        && /attr\.key\.as_ref\(\)/.test(sources.quickXml)
        && /attr\.value\.as_ref\(\)/.test(sources.quickXml)
        && /encode_utf16\(\)/.test(sources.quickXml),
      evidence: [
        'read_event_into(&mut buffer)',
        'Event::Start(event)',
        'event.name().as_ref()',
        'attr.key.as_ref()',
        'attr.value.as_ref()',
        'event.decode()?',
        'value.encode_utf16()',
      ],
    },
    {
      id: 'stax-event-public-objects',
      supported: /new EventReaderSync\(xml\)/.test(sources.externalBaseline)
        && /event\.name/.test(sources.externalBaseline)
        && /Object\.entries\(event\.attributes\)/.test(sources.externalBaseline),
      evidence: [
        'new EventReaderSync(xml)',
        'event.name',
        'Object.entries(event.attributes)',
      ],
    },
    {
      id: 'stax-stream-index-accessors',
      supported: /new StreamReaderSync\(bytes\)/.test(sources.externalBaseline)
        && /batch\.nameAt\(index\)/.test(sources.externalBaseline)
        && /batch\.attributeNameAt\(index, attrIndex\)/.test(sources.externalBaseline)
        && /batch\.attributeValueAt\(index, attrIndex\)/.test(sources.externalBaseline),
      evidence: [
        'new StreamReaderSync(bytes)',
        'batch.nameAt(index)',
        'batch.attributeNameAt(index, attrIndex)',
        'batch.attributeValueAt(index, attrIndex)',
      ],
    },
    {
      id: 'lazy-getters-negative-ledger',
      supported: /CLAIM-LAZY-GETTERS[\s\S]*NEGATIVE_RESULT/.test(sources.proofLedger),
      evidence: [
        'CLAIM-LAZY-GETTERS',
        'NEGATIVE_RESULT',
      ],
    },
  ];

  return {
    allSupported: checks.every(check => check.supported),
    items: checks,
    missing: checks.filter(check => !check.supported).map(check => check.id),
  };
}

function createConsumers(sourceChecks, baseline) {
  const rows = [
    {
      id: 'woodstox',
      implementation: 'Java + Woodstox XMLStreamReader',
      runtimeShape: 'java-xmlstreamreader-cursor',
      sourceCheck: 'woodstox-cursor-getters',
      perEventPublicObject: false,
      materialization: 'cursor getters returning Java primitives/String values',
      objectShapeComparableToJsPublicEvent: false,
    },
    {
      id: 'quick-xml',
      implementation: 'Rust + quick-xml Reader',
      runtimeShape: 'rust-enum-event-with-buffer-lifetime',
      sourceCheck: 'quick-xml-buffered-enum-events',
      perEventPublicObject: false,
      materialization: 'enum events plus byte views/Cow string decode',
      objectShapeComparableToJsPublicEvent: false,
    },
    {
      id: 'stax-stream',
      implementation: 'Node + stax-xml StreamReaderSync',
      runtimeShape: 'js-stream-batch-index-accessors',
      sourceCheck: 'stax-stream-index-accessors',
      perEventPublicObject: false,
      materialization: 'batch index accessors returning JS string primitives',
      objectShapeComparableToJsPublicEvent: false,
    },
    {
      id: 'stax-event',
      implementation: 'Node + stax-xml EventReaderSync',
      runtimeShape: 'js-public-event-object',
      sourceCheck: 'stax-event-public-objects',
      perEventPublicObject: true,
      materialization: 'public JavaScript event objects and attribute objects',
      objectShapeComparableToJsPublicEvent: true,
    },
  ];

  return rows.map(row => ({
    ...row,
    semanticFields,
    sourceSupported: sourceChecks.items.find(check => check.id === row.sourceCheck)?.supported ?? false,
    baseline: baseline.results.find(result => result.tool === row.id && result.status === 'ok') ?? null,
  }));
}

function createParity(consumers) {
  const rowsWithBaseline = consumers.filter(consumer => consumer.baseline);
  const first = rowsWithBaseline[0]?.baseline ?? null;
  const sameBaseline = first
    ? rowsWithBaseline.every(consumer => consumer.baseline.eventCount === first.eventCount && consumer.baseline.checksum === first.checksum)
    : false;
  return {
    status: sameBaseline ? 'same-semantic-fields' : 'missing-or-mismatched-baseline',
    baselineRows: rowsWithBaseline.map(consumer => ({
      id: consumer.id,
      eventCount: consumer.baseline.eventCount,
      checksum: consumer.baseline.checksum,
      mibPerSec: consumer.baseline.mibPerSec,
    })),
    notSameObjectShape: consumers.some(consumer => consumer.runtimeShape !== 'js-public-event-object'),
    explanation: 'The parity boundary is event/checksum/field equality, not identical language object representation.',
  };
}

function createFindings(consumers, parity, sourceChecks) {
  const findings = [
    {
      id: 'same-semantic-materialization-contract',
      classification: parity.status === 'same-semantic-fields' && sourceChecks.allSupported
        ? 'SOURCE_FACT + BENCH_FACT'
        : 'MISSING_EVIDENCE',
      summary: 'The external and JavaScript rows consume the same semantic fields when their event count and checksum match.',
      evidence: [
        `semantic fields: ${semanticFields.join(', ')}`,
        ...parity.baselineRows.map(row => `${row.id}: events=${row.eventCount}, checksum=${row.checksum}`),
      ],
    },
    {
      id: 'not-same-object-shape',
      classification: 'COUNTEREXAMPLE',
      summary: 'The same semantic fields are not the same object shape across Java, Rust, and JavaScript runtimes.',
      evidence: consumers.map(consumer => `${consumer.id}: ${consumer.runtimeShape}, perEventPublicObject=${consumer.perEventPublicObject}`),
    },
    {
      id: 'runtime-limit-still-unproven',
      classification: 'HYPOTHESIS',
      summary: 'Object-shape differences and current throughput gaps do not prove a JavaScript runtime ceiling.',
      evidence: [
        'A 200 MiB/s+ bounded-memory full-string JavaScript row remains a valid counterexample.',
        'Partial byte-scan or partial string rows are parser/runtime headroom evidence, not StAX full-materialization proof.',
      ],
    },
    {
      id: 'lazy-getters-remain-rejected',
      classification: sourceChecks.items.find(check => check.id === 'lazy-getters-negative-ledger')?.supported
        ? 'NEGATIVE_RESULT'
        : 'MISSING_EVIDENCE',
      summary: 'Lazy getters remain a recorded negative result, not a fresh default optimization candidate.',
      evidence: [
        'They can improve count-only paths while moving or destabilizing full-string cache/materialization costs.',
        'Revisit only with full-string improvement, bounded memory, and no cache-shape regression.',
      ],
    },
  ];

  if (!sourceChecks.allSupported) {
    findings.push({
      id: 'source-check-missing',
      classification: 'AUDIT_WARNING',
      summary: 'One or more expected source patterns were not found.',
      evidence: sourceChecks.missing,
    });
  }

  return findings;
}

function readExternalBaseline(path) {
  if (!existsSync(path)) {
    return {
      source: path,
      generatedAt: null,
      results: [],
    };
  }
  const report = JSON.parse(readFileSync(path, 'utf8'));
  return {
    source: path,
    generatedAt: report.generatedAt,
    fixture: report.fixture,
    options: report.options,
    results: report.results ?? [],
  };
}

function createSelfTestBaseline() {
  const result = {
    status: 'ok',
    workload: 'full-string-checksum',
    eventCount: 967967,
    checksum: -746772258,
    mibPerSec: 100,
  };
  return {
    source: 'self-test',
    generatedAt: 'self-test',
    results: [
      { ...result, tool: 'woodstox' },
      { ...result, tool: 'quick-xml' },
      { ...result, tool: 'stax-stream' },
      { ...result, tool: 'stax-event' },
    ],
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Materialization Contract Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This audit separates same semantic fields from same runtime object shape.',
    'The external baseline rows are comparable through event count, checksum, and field materialization parity; they are not the same object shape.',
    'It does not prove a JavaScript runtime ceiling.',
    '',
    '## Contract',
    '',
    `Parity status: ${report.parity.status}`,
    `Not same object shape: ${report.parity.notSameObjectShape ? 'yes' : 'no'}`,
  ];

  lines.push(`External baseline artifact: ${report.metadata.externalBaselineReport}`);
  lines.push(`External baseline generated: ${report.baseline.generatedAt ?? 'n/a'}`);
  if (report.baseline.fixture) {
    lines.push(`External baseline fixture: ${report.baseline.fixture.path ?? 'n/a'}`);
    if (report.baseline.fixture.sizeMiB !== undefined) {
      lines.push(`External baseline fixture size: ${formatNumber(report.baseline.fixture.sizeMiB)} MiB`);
    }
  }

  lines.push('');
  lines.push('Shared full-string checksum fields:');

  for (const field of report.semanticFields) {
    lines.push(`- ${field}`);
  }

  lines.push('');
  lines.push('## Consumers');
  lines.push('');
  lines.push('| Consumer | Runtime shape | Per-event public object | Source check | Events | Checksum |');
  lines.push('| --- | --- | --- | --- | ---: | ---: |');
  for (const consumer of report.consumers) {
    lines.push(
      `| ${consumer.id} | ${consumer.runtimeShape} | ${consumer.perEventPublicObject ? 'yes' : 'no'} | `
      + `${consumer.sourceSupported ? 'yes' : 'no'} | ${consumer.baseline?.eventCount ?? 'n/a'} | ${consumer.baseline?.checksum ?? 'n/a'} |`,
    );
  }

  lines.push('');
  lines.push('## Shape Boundary');
  lines.push('');
  lines.push('- Woodstox uses `XMLStreamReader` cursor/accessor calls; it does not create `EventReaderSync` public event objects.');
  lines.push('- quick-xml uses Rust enum events tied to a reused buffer; it does not create JavaScript public event objects.');
  lines.push('- `EventReaderSync` public event objects are only the JavaScript public-object row.');
  lines.push('- `StreamReaderSync` byte batches are a separate JavaScript batch/index-accessor shape.');
  lines.push('');
  lines.push('## Source Checks');
  lines.push('');
  lines.push('| Check | Supported | Evidence |');
  lines.push('| --- | --- | --- |');
  for (const check of report.sourceChecks.items) {
    lines.push(`| ${check.id} | ${check.supported ? 'yes' : 'no'} | ${check.evidence.map(escapePipe).join('<br>')} |`);
  }

  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  lines.push('## Guardrails');
  lines.push('');
  lines.push('- Say "same semantic fields" or "same full-string checksum contract", not "same object shape", for Woodstox and quick-xml comparisons.');
  lines.push('- Lazy getters remain a recorded negative result unless a new full-string benchmark proves otherwise.');
  lines.push('- A language/runtime limit conclusion still requires source facts, trace facts, allocation evidence, browser rows, and failed counterexample searches.');
  lines.push('');

  return lines.join('\n');
}

function escapePipe(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function readRequiredFile(path) {
  if (!existsSync(path)) throw new Error(`Missing source file: ${path}`);
  return readFileSync(path, 'utf8');
}

function writeOutput(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

main();
