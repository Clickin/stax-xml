import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = join(__dirname, 'results', 'release', 'stax-event-public-object-shape-audit.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'stax-event-public-object-shape-audit.md');
const externalBaselineSource = join(__dirname, 'external-baseline.mjs');
const materializationContractAudit = join(__dirname, 'results', 'release', 'materialization-contract-audit.json');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    externalBaselineSource,
    materializationContractAudit,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
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
      case '--external-baseline-source':
        options.externalBaselineSource = resolve(process.cwd(), readValue());
        break;
      case '--materialization-contract-audit':
        options.materializationContractAudit = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function main() {
  const options = parseArgs();
  const report = createReport(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`stax-event-public-object-shape-audit: source=${report.summary.sourcePublicObjectPathPresent} releaseRow=${report.summary.releaseOneGiBRowPresent}`);
}

function createReport(options) {
  const source = readFileSync(options.externalBaselineSource, 'utf8');
  const materialization = JSON.parse(readFileSync(options.materializationContractAudit, 'utf8'));
  const staxEventConsumer = materialization.consumers?.find(entry => entry.id === 'stax-event') ?? null;
  const sourceFacts = {
    staxEventToolDeclared: /'stax-event'/.test(source),
    staxEventUsesFullUtf8StringInput: /const xml = needsStaxEvent \? readTextFile\(options\.file\) : null;/.test(source)
      && /function readTextFile\(filePath\)[\s\S]*readFileSync\(filePath, 'utf8'\)/.test(source),
    staxEventUsesEventReaderSyncPublicObjects: /for \(const event of new EventReaderSync\(xml\)\)/.test(source)
      && /Object\.entries\(event\.attributes\)/.test(source),
    fileBackedStreamRowsUseByteBatches: /createFileByteBatches\(options\.file, chunkBytes, options\.batchSize\)/.test(source),
  };
  const releaseOneGiBRowPresent = Boolean(staxEventConsumer?.baseline);
  const sourcePublicObjectPathPresent = sourceFacts.staxEventToolDeclared
    && sourceFacts.staxEventUsesFullUtf8StringInput
    && sourceFacts.staxEventUsesEventReaderSyncPublicObjects;

  return {
    generatedAt: new Date().toISOString(),
    objective: 'stax-event-public-object-shape-audit',
    contract: 'source-public-object-row-vs-file-backed-low-memory-scope',
    note: 'Audits why the JavaScript public event object consumer is not a 1 GiB file-backed external-baseline comparator row.',
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      v8: process.versions.v8,
    },
    sourceFiles: {
      externalBaseline: options.externalBaselineSource,
      materializationContractAudit: options.materializationContractAudit,
    },
    sourceFacts,
    materializationAudit: {
      externalBaselineReport: materialization.metadata?.externalBaselineReport ?? null,
      staxEventRuntimeShape: staxEventConsumer?.runtimeShape ?? null,
      staxEventPerEventPublicObject: staxEventConsumer?.perEventPublicObject ?? null,
      staxEventBaselinePresent: releaseOneGiBRowPresent,
    },
    summary: {
      sourcePublicObjectPathPresent,
      releaseOneGiBRowPresent,
      releaseOneGiBRowOmittedForLowMemoryComparison: sourcePublicObjectPathPresent && !releaseOneGiBRowPresent,
      conclusion: sourcePublicObjectPathPresent && !releaseOneGiBRowPresent
        ? 'public-object-source-path-present-but-not-a-file-backed-low-memory-comparator-row'
        : 'scope-needs-review',
    },
    findings: createFindings(sourcePublicObjectPathPresent, releaseOneGiBRowPresent, sourceFacts, staxEventConsumer),
  };
}

function createFindings(sourcePublicObjectPathPresent, releaseOneGiBRowPresent, sourceFacts, staxEventConsumer) {
  return [
    {
      id: 'public-object-source-path-present',
      classification: sourcePublicObjectPathPresent ? 'SOURCE_FACT' : 'MISSING_EVIDENCE',
      summary: 'external-baseline.mjs contains a JavaScript public event object consumer using EventReaderSync.',
      evidence: [
        `staxEventToolDeclared=${sourceFacts.staxEventToolDeclared}`,
        `usesFullUtf8StringInput=${sourceFacts.staxEventUsesFullUtf8StringInput}`,
        `usesEventReaderSyncPublicObjects=${sourceFacts.staxEventUsesEventReaderSyncPublicObjects}`,
      ],
    },
    {
      id: 'not-file-backed-low-memory-row',
      classification: sourcePublicObjectPathPresent && !releaseOneGiBRowPresent ? 'SCOPE_GUARD' : 'AUDIT_WARNING',
      summary: 'The public object consumer requires preloading the whole XML as a UTF-8 JavaScript string in this harness, while file-backed rows use byte batches.',
      evidence: [
        `fileBackedStreamRowsUseByteBatches=${sourceFacts.fileBackedStreamRowsUseByteBatches}`,
        `oneGiBMaterializationAuditBaselinePresent=${releaseOneGiBRowPresent}`,
      ],
    },
    {
      id: 'shape-boundary-preserved',
      classification: 'SOURCE_FACT',
      summary: 'The materialization contract audit keeps stax-event as the JS public-object shape, separate from Woodstox and quick-xml comparator shapes.',
      evidence: [
        `staxEventRuntimeShape=${staxEventConsumer?.runtimeShape ?? 'missing'}`,
        `staxEventPerEventPublicObject=${staxEventConsumer?.perEventPublicObject ?? 'missing'}`,
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# StAX Event Public Object Shape Audit');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Public object source path present: ${report.summary.sourcePublicObjectPathPresent ? 'yes' : 'no'}`);
  lines.push(`- 1 GiB materialization audit row present: ${report.summary.releaseOneGiBRowPresent ? 'yes' : 'no'}`);
  lines.push(`- Low-memory file-backed comparator row omitted: ${report.summary.releaseOneGiBRowOmittedForLowMemoryComparison ? 'yes' : 'no'}`);
  lines.push(`- Conclusion: ${report.summary.conclusion}`);
  lines.push('');
  lines.push('## Source Facts');
  lines.push('');
  for (const [key, value] of Object.entries(report.sourceFacts)) {
    lines.push(`- ${key}: ${value ? 'yes' : 'no'}`);
  }
  lines.push('');
  lines.push('## Materialization Audit Link');
  lines.push('');
  lines.push(`- External baseline artifact: ${report.materializationAudit.externalBaselineReport ?? 'n/a'}`);
  lines.push(`- stax-event runtime shape: ${report.materializationAudit.staxEventRuntimeShape ?? 'n/a'}`);
  lines.push(`- stax-event per-event public object: ${report.materializationAudit.staxEventPerEventPublicObject ? 'yes' : 'no'}`);
  lines.push(`- stax-event baseline present: ${report.materializationAudit.staxEventBaselinePresent ? 'yes' : 'no'}`);
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
  lines.push('## Guardrail');
  lines.push('');
  lines.push('- Do not compare the 1 GiB Woodstox/quick-xml file-backed rows as if they also created JavaScript public event objects.');
  lines.push('- A future JS public-object 1 GiB row must either accept the full-string preload memory cost explicitly or use a separate streaming public-object reader contract.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

main();
