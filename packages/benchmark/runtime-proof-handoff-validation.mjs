import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultHandoffJson = resolve(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'runtime-proof-handoff-validation.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'runtime-proof-handoff-validation.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    handoffJson: defaultHandoffJson,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
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
      case '--handoff-json':
        options.handoffJson = resolve(process.cwd(), readValue());
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs();
  const handoff = readHandoff(options.handoffJson);
  const report = createReport(handoff, options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function readHandoff(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`handoff JSON was not found: ${filePath}`);
  }
  const handoff = JSON.parse(readFileSync(filePath, 'utf8'));
  if (handoff.objective !== 'runtime-proof-gap-handoff') {
    throw new Error(`expected runtime-proof-gap-handoff JSON, got ${handoff.objective ?? 'unknown'}`);
  }
  return handoff;
}

function createReport(handoff, options) {
  const handoffRows = Array.isArray(handoff.handoffs) ? handoff.handoffs : [];
  const commandChecks = handoffRows.flatMap(handoffRow =>
    (handoffRow.commands ?? []).map(command => validateCommand(handoffRow, command))
  );
  const handoffChecks = handoffRows.map(validateHandoff);
  const requiredHandoffIds = ['safari-webkit-browser-row-handoff', 'spidermonkey-codegen-handoff'];
  const requiredHandoffsPresent = requiredHandoffIds.every(id => handoffRows.some(row => row.id === id));
  const allCommandsReferenceExistingScripts = commandChecks.every(check => check.scriptPaths.every(script => script.exists));
  const allReleaseOutputsCurated = commandChecks.every(check => check.releaseOutputPaths.every(output => output.underRelease));
  const allRawOutputsSeparated = commandChecks.every(check => check.rawOutputPaths.every(output => output.underRawOrCrossProcess));
  const allRequiredFlagsPresent = handoffChecks.every(check => check.requiredFlagsPresent);
  const allContractsPresent = handoffChecks.every(check => check.contractsPresent);
  const pass = requiredHandoffsPresent
    && allCommandsReferenceExistingScripts
    && allReleaseOutputsCurated
    && allRawOutputsSeparated
    && allRequiredFlagsPresent
    && allContractsPresent
    && (handoff.summary?.unhandledObligationCount ?? 1) === 0;

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'runtime-proof-handoff-validation',
    contract: 'external-run-handoff-command-and-contract-static-validation',
    note: 'Static validation for runtime-proof-gap-handoff external runbooks. This is not benchmark evidence, not emitted JIT IR, not Safari/WebKit throughput evidence, and not a runtime-limit conclusion.',
    inputs: {
      handoffJson: options.handoffJson,
      handoffGeneratedAt: handoff.generatedAt ?? null,
      handoffObjective: handoff.objective,
      handoffContract: handoff.contract,
    },
    summary: {
      pass,
      handoffCount: handoffRows.length,
      requiredHandoffsPresent,
      commandCount: commandChecks.length,
      scriptsReferenced: unique(commandChecks.flatMap(check => check.scriptPaths.map(script => script.path))).length,
      missingScriptCount: commandChecks.flatMap(check => check.scriptPaths).filter(script => !script.exists).length,
      releaseOutputPathCount: commandChecks.flatMap(check => check.releaseOutputPaths).length,
      nonReleaseOutputPathCount: commandChecks.flatMap(check => check.releaseOutputPaths).filter(output => !output.underRelease).length,
      rawOutputPathCount: commandChecks.flatMap(check => check.rawOutputPaths).length,
      rawOutputPathPolicyViolationCount: commandChecks.flatMap(check => check.rawOutputPaths).filter(output => !output.underRawOrCrossProcess).length,
      allRequiredFlagsPresent,
      allContractsPresent,
      unhandledObligationCount: handoff.summary?.unhandledObligationCount ?? null,
      conclusionAllowed: false,
    },
    handoffChecks,
    commandChecks,
    findings: createFindings(pass, handoffChecks, commandChecks),
  };
  return report;
}

function validateHandoff(handoff) {
  const commands = handoff.commands ?? [];
  const commandText = commands.map(command => command.command).join('\n');
  const sourceConsumption = handoff.sourceConsumptionContract ?? {};
  const sourceBoundary = handoff.sourceBoundaryContract ?? {};
  const closureChecks = handoff.closureChecks ?? [];
  const expectedEvidence = handoff.expectedEvidence ?? [];
  const scopeGuards = handoff.scopeGuards ?? [];
  const isSafari = handoff.id === 'safari-webkit-browser-row-handoff';
  const isSpiderMonkey = handoff.id === 'spidermonkey-codegen-handoff';
  const requiredFlags = isSafari
    ? [
        /--harness safari-webdriver/,
        /--driver-executable \/usr\/bin\/safaridriver/,
        /--process-runs 3/,
        /--size-gib 1/,
        /--fixture-shape corpus-cycle/,
        /--corpus-file packages\/benchmark\/assets\/books\.xml/,
        /--cases stringFull,eventObjectFull,rawFrameNameId/,
        /safari-webkit-closure-audit\.mjs/,
      ]
    : isSpiderMonkey
      ? [
          /FIREFOX_PATH=\/path\/to\/firefox/,
          /SPIDERMONKEY_JS_SHELL=\/path\/to\/js/,
          /--package-kind release/,
          /--package-kind nightly/,
          /firefox-spidermonkey-diagnostic-dump-audit\.mjs/,
          /stax-public-reader-host-api-boundary-audit\.mjs/,
          /spidermonkey-jsshell-tokenizer-headroom\.mjs/,
          /spidermonkey-jsshell-materialized-headroom\.mjs/,
          /spidermonkey-codegen-closure-audit\.mjs/,
          /spidermonkey-codegen-rerun-stability-audit\.mjs/,
        ]
      : [];
  const requiredContracts = isSafari
    ? [
        /synchronous Iterable<Uint8Array\[\]>/,
        /must not pass one full XML ArrayBuffer/,
        /source-overhead evidence only/,
        /directReadableStreamFullStringRowsRecorded/,
        /must not substitute for primarySyncByteBatchRowsRecorded/,
        /primaryRowsInSameContractComparison/,
        /largeBoundedPrimarySyncByteBatchRowsRecorded/,
        /largePrimaryRowsInSameContractComparison/,
        /same-contract-runtime-comparison\.json/,
        /row id, event count, and checksum/,
        /safari-webkit-closure-audit\.json/,
        /summary\.qualifiedClosureCount must be greater than 0/,
        /qualifiedClosureCount=0/,
        /Safari\/WebKit closure audit checks/,
        /Current host cannot run Safari\/WebKit browser rows/,
        /hostPlatform=[^,\)]+/,
        /safaridriverFound=false/,
        /currentHarnessSupportsSafari=true/,
        /canRunSafariBrowserRows=false/,
        /candidateRows=0/,
        /backpressure is respected/,
        /Memory evidence is classified explicitly/,
        /missing Safari JS heap counters must not be treated as bounded-memory proof/,
        /runtime-counterexample-scan\.json/,
        /200 MiB\/s\+ bounded-memory row as a counterexample/,
        /exact Safari version/,
        /TextDecoder\/UTF-8 decode source lines/,
        /row-level source-boundary metadata/,
        /rowLevelSourceBoundaryPinnedRowsRecorded/,
        /largeBoundedPrimarySyncByteBatchRowsWithRowLevelSourceBoundaryPin/,
        /row-level source revision and source-pin artifact metadata/,
      ]
    : isSpiderMonkey
      ? [
          /emitted Firefox\/SpiderMonkey JIT IR/,
          /runtime\/build identity/,
          /diagnostic flags/,
          /selected row id/,
          /closesEmittedIrObligation=true/,
          /sameContractStaxRow=true/,
          /canRunCurrentStaxFullStringBenchmark=true/,
          /selectedRowMatchesCurrentComparison=true/,
          /evidenceClassAllowed=true/,
          /same-contract-runtime-comparison\.json/,
          /event count/,
          /checksum parity/,
          /emitted IR or optimized-code dump metadata/,
          /sourceRevision=[0-9a-f]{40}/,
          /selectedRowIdentityStatus=/,
          /selectedRowIdentityStatusCounts/,
          /spidermonkey-ascii-scope-distance-audit\.json/,
          /ASCII scope-distance audit pins/,
          /stax-public-reader-host-api-boundary-audit\.json/,
          /StAX public reader host API boundary audit pins/,
          /alternateDecoderWouldBeUnchangedClosure=false/,
          /TextDecoder\/ReadableStream\/TextEncoder boundary/,
          /spidermonkey-jsshell-tokenizer-headroom\.json/,
          /partial parser-core headroom only/,
          /spidermonkey-jsshell-materialized-headroom\.json/,
          /JS string\/object materialization headroom only/,
          /sameSemanticChecksumFields=true/,
          /fullStringParity=false/,
          /memoryProofRows=0/,
          /counterexamples200MiB=0/,
          /spidermonkey-codegen-closure-audit\.json/,
          /spidermonkey-codegen-rerun-stability-audit\.json/,
          /against same-contract comparison generatedAt=[^,]+, comparisonRowCount=\d+/,
          /selectedRowMetadataMissingFieldCounts selectedChecksum=\d+, selectedEventCount=\d+, selectedRowId=\d+/,
          /selectedRowComparisonMatchCount=\d+, selectedRowComparisonMismatchCount=\d+, selectedRowComparisonMissingCount=\d+/,
          /closingMetadataMissingFieldCounts diagnosticFlags=\d+, emittedDumpMetadata=\d+, runtimeBuildIdentity=\d+/,
          /disallowedEvidenceClassCounts .*current-debug-codegen-scope-guard=\d+/,
          /selectedRowIdentityStatusCounts not-claimed-non-stax-diagnostic=\d+/,
          /qualifiedClosureCount=0/,
          /contradictedClosureClaimCount=0/,
          /closestBlockedCandidateCount=/,
          /minimumBlockedRequirementCount=/,
          /closestBlockedCandidates=.*spidermonkey-taskcluster-debug-jsshell-codegen-audit\.json.*spidermonkey-taskcluster-debug-jsshell-codegen-rerun\.json.*spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit\.json.*spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun\.json.*spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit\.json/,
          /evidenceClassAllowed=\d+/,
          /summary\.qualifiedClosureCount must be greater than 0/,
          /summary\.qualifiedClosureCount must remain 0/,
          /closesCodegenObligation=false/,
          /jit-status-only/,
          /environment evidence only/,
        ]
      : [];
  const contractText = [
    ...Object.values(sourceConsumption),
    ...Object.values(sourceBoundary),
    ...(handoff.localClosure?.evidenceArtifacts ?? []),
    ...(handoff.localClosure?.blockers ?? []),
    JSON.stringify(handoff.localClosure?.diagnosticIdentityStatusCounts ?? {}),
    handoff.localClosure?.scopeGuard ?? '',
    ...closureChecks,
    ...expectedEvidence,
    ...scopeGuards,
  ].join('\n');
  return {
    id: handoff.id,
    classification: handoff.classification,
    localRunnable: handoff.localClosure?.localRunnable ?? null,
    localStatus: handoff.localClosure?.localStatus ?? null,
    commandCount: commands.length,
    requiredFlagsPresent: requiredFlags.every(pattern => pattern.test(commandText)),
    contractsPresent: requiredContracts.every(pattern => pattern.test(contractText)),
    requiredFlagPatterns: requiredFlags.map(pattern => pattern.source),
    requiredContractPatterns: requiredContracts.map(pattern => pattern.source),
  };
}

function validateCommand(handoff, command) {
  const scriptPaths = extractNodeScripts(command.command).map(scriptPath => ({
    path: scriptPath,
    exists: existsSync(resolve(repoRoot, scriptPath)),
  }));
  const releaseOutputPaths = extractFlagPaths(command.command, ['--json-out', '--md-out']).map(outputPath => ({
    path: outputPath,
    underRelease: isUnder(outputPath, 'packages/benchmark/results/release'),
  }));
  const rawOutputPaths = extractFlagPaths(command.command, ['--output-dir']).map(outputPath => ({
    path: outputPath,
    underRawOrCrossProcess: isUnder(outputPath, 'packages/benchmark/results/cross-process')
      || isUnder(outputPath, 'packages/benchmark/results/firefox-spidermonkey-diagnostic-dump-audit'),
  }));
  return {
    handoffId: handoff.id,
    id: command.id,
    scriptPaths,
    releaseOutputPaths,
    rawOutputPaths,
    command: command.command,
  };
}

function extractNodeScripts(command) {
  const scripts = [];
  const pattern = /\bnode\s+(packages\/benchmark\/[^\s`]+?\.mjs)\b/g;
  for (const match of command.matchAll(pattern)) {
    scripts.push(match[1]);
  }
  return unique(scripts);
}

function extractFlagPaths(command, flags) {
  const paths = [];
  for (const flag of flags) {
    const pattern = new RegExp(`${escapeRegExp(flag)}(?:=|\\s+)([^\\s` + '`' + `]+)`, 'g');
    for (const match of command.matchAll(pattern)) {
      paths.push(match[1]);
    }
  }
  return unique(paths);
}

function isUnder(filePath, parentPath) {
  const absoluteFile = resolve(repoRoot, filePath);
  const absoluteParent = resolve(repoRoot, parentPath);
  const rel = relative(absoluteParent, absoluteFile);
  return rel === '' || (!rel.startsWith('..') && !resolve(rel).startsWith('..'));
}

function createFindings(pass, handoffChecks, commandChecks) {
  return [
    {
      id: 'handoff-static-validation',
      classification: pass ? 'CONTRACT_FACT' : 'OPEN',
      summary: pass
        ? 'Every current runtime proof handoff has existing local entrypoint scripts, curated release outputs, separated raw outputs, and required closure contracts.'
        : 'At least one runtime proof handoff command or contract failed static validation.',
      evidence: [
        `handoffs=${handoffChecks.map(check => `${check.id}:${check.requiredFlagsPresent && check.contractsPresent ? 'ok' : 'incomplete'}`).join(', ')}`,
        `commands=${commandChecks.length}`,
      ],
    },
    {
      id: 'handoff-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'Static handoff validation is runbook quality evidence only; it cannot close Safari/WebKit browser rows or SpiderMonkey emitted IR obligations.',
      evidence: [
        'No external benchmark command is executed by this audit.',
        'No emitted SpiderMonkey IR, optimized code, or Safari/WebKit throughput row is produced by this audit.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Runtime Proof Handoff Validation',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Pass: ${report.summary.pass ? 'yes' : 'no'}`,
    `- Handoffs: ${report.summary.handoffCount}`,
    `- Required handoffs present: ${report.summary.requiredHandoffsPresent ? 'yes' : 'no'}`,
    `- Commands checked: ${report.summary.commandCount}`,
    `- Scripts referenced: ${report.summary.scriptsReferenced}`,
    `- Missing scripts: ${report.summary.missingScriptCount}`,
    `- Release output paths: ${report.summary.releaseOutputPathCount}`,
    `- Non-release output paths: ${report.summary.nonReleaseOutputPathCount}`,
    `- Raw output paths: ${report.summary.rawOutputPathCount}`,
    `- Raw output path policy violations: ${report.summary.rawOutputPathPolicyViolationCount}`,
    `- Required flags present: ${report.summary.allRequiredFlagsPresent ? 'yes' : 'no'}`,
    `- Required contracts present: ${report.summary.allContractsPresent ? 'yes' : 'no'}`,
    `- Unhandled obligations in handoff: ${report.summary.unhandledObligationCount}`,
    `- Runtime-limit conclusion allowed: ${report.summary.conclusionAllowed ? 'yes' : 'no'}`,
    '',
    '## Handoff Checks',
    '',
    '| Handoff | Local status | Commands | Required flags | Required contracts |',
    '| --- | --- | ---: | --- | --- |',
  ];
  for (const check of report.handoffChecks) {
    lines.push(`| \`${check.id}\` | ${check.localStatus ?? 'unknown'} | ${check.commandCount} | ${check.requiredFlagsPresent ? 'yes' : 'no'} | ${check.contractsPresent ? 'yes' : 'no'} |`);
  }
  lines.push('', '## Command Checks', '', '| Handoff | Command | Scripts | Scripts existing | Release outputs curated | Raw outputs separated |', '| --- | --- | --- | --- | --- | --- |');
  for (const check of report.commandChecks) {
    const scriptsOk = check.scriptPaths.length === 0 ? 'none' : check.scriptPaths.every(script => script.exists) ? 'yes' : 'no';
    const releaseOk = check.releaseOutputPaths.length === 0 ? 'none' : check.releaseOutputPaths.every(output => output.underRelease) ? 'yes' : 'no';
    const rawOk = check.rawOutputPaths.length === 0 ? 'none' : check.rawOutputPaths.every(output => output.underRawOrCrossProcess) ? 'yes' : 'no';
    const scripts = check.scriptPaths.length === 0
      ? 'none'
      : check.scriptPaths.map(script => `\`${script.path}\``).join('<br>');
    lines.push(`| \`${check.handoffId}\` | \`${check.id}\` | ${scripts} | ${scriptsOk} | ${releaseOk} | ${rawOk} |`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence ?? []) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function printSummary(report) {
  console.log(`runtime-proof-handoff-validation: pass=${report.summary.pass} commands=${report.summary.commandCount}`);
}

function unique(values) {
  return Array.from(new Set(values));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
