import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultAuditJson = resolve(__dirname, 'results', 'release', 'runtime-proof-coverage-audit.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    auditJson: defaultAuditJson,
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
      case '--audit-json':
        options.auditJson = resolve(process.cwd(), readValue());
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
  const audit = readAudit(options.auditJson);
  const report = createReport(audit, options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function readAudit(auditJson) {
  if (!existsSync(auditJson)) {
    throw new Error(`coverage audit JSON was not found: ${auditJson}`);
  }
  const audit = JSON.parse(readFileSync(auditJson, 'utf8'));
  if (audit.objective !== 'runtime-proof-coverage-audit') {
    throw new Error(`expected runtime-proof-coverage-audit JSON, got ${audit.objective ?? 'unknown'}`);
  }
  return audit;
}

function createReport(audit, options) {
  const obligations = audit.obligations ?? [];
  const activeObligations = obligations.filter(obligation => obligation.status !== 'covered');
  const handoffs = createHandoffs(activeObligations);
  const handled = new Set(handoffs.flatMap(handoff => handoff.obligationIds));
  const unhandledObligations = activeObligations
    .filter(obligation => !handled.has(obligation.id))
    .map(obligation => ({
      id: obligation.id,
      status: obligation.status,
      reason: 'No concrete external-run handoff is defined yet for this obligation.',
      nextExperiment: obligation.nextExperiment ?? null,
    }));

  return {
    generatedAt: new Date().toISOString(),
    objective: 'runtime-proof-gap-handoff',
    contract: 'external-proof-gap-runbook-linked-to-coverage-audit',
    note: 'Turns current open or partial runtime proof obligations into concrete external-run handoffs. This is not benchmark evidence, not emitted JIT IR, not Safari/WebKit throughput evidence, and not a runtime-limit conclusion.',
    inputs: {
      auditJson: options.auditJson,
      auditGeneratedAt: audit.generatedAt,
      auditObjective: audit.objective,
      auditContract: audit.contract,
    },
    auditSummary: {
      artifactCount: audit.scannedArtifacts?.length ?? null,
      measuredRows: audit.summary?.measuredRows ?? audit.rowCount ?? null,
      counterexamples: audit.summary?.counterexamples ?? null,
      activeObligations: activeObligations.map(obligation => ({
        id: obligation.id,
        status: obligation.status,
        evidence: obligation.evidence,
        nextExperiment: obligation.nextExperiment,
      })),
    },
    handoffs,
    unhandledObligations,
    findings: createFindings(activeObligations, handoffs, unhandledObligations),
  };
}

function createHandoffs(activeObligations) {
  const byId = new Map(activeObligations.map(obligation => [obligation.id, obligation]));
  const handoffs = [];

  if (byId.has('safari-jsc-source-and-browser-rows-open')) {
    handoffs.push({
      id: 'safari-webkit-browser-row-handoff',
      obligationIds: ['safari-jsc-source-and-browser-rows-open'],
      classification: 'EXTERNAL_RUN_REQUIRED',
      proofGoal: 'Produce same-contract Safari/WebKit browser rows separate from Bun/JSC, then rerun the coverage audit and counterexample scan.',
      prerequisites: [
        'macOS host with the exact Safari/WebKit build under test.',
        'Safari WebDriver enabled and safaridriver available, normally /usr/bin/safaridriver.',
        'Repository checkout with benchmark dependencies installed and stax-xml build artifacts available.',
        'Use the same full-string checksum rows: stringFull, eventObjectFull, and rawFrameNameId before broadening cases.',
      ],
      commands: [
        {
          id: 'safari-availability-audit',
          purpose: 'Record whether the host can run Safari/WebKit rows.',
          command: 'node packages/benchmark/safari-webkit-availability-audit.mjs --json-out packages/benchmark/results/release/safari-webkit-availability-audit.json --md-out packages/benchmark/results/release/safari-webkit-availability-audit.md',
        },
        {
          id: 'safari-smoke',
          purpose: 'Prove the safaridriver harness can launch the target browser and preserve checksum parity on a small row.',
          command: 'node packages/benchmark/safari-webdriver-candidate-headroom.mjs --driver-executable /usr/bin/safaridriver --size-gib 0.001 --fixture-shape diverse-cycle --diverse-cycle-size 64 --cases stringFull,eventObjectFull,rawFrameNameId --json-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-smoke.json --md-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-smoke.md',
        },
        {
          id: 'safari-books-corpus-cross-process',
          purpose: 'Generate the first 1 GiB same-contract Safari/WebKit corpus stability row set.',
          command: 'node packages/benchmark/browser-candidate-headroom-cross-process.mjs --harness safari-webdriver --driver-executable /usr/bin/safaridriver --process-runs 3 --size-gib 1 --fixture-shape corpus-cycle --corpus-file packages/benchmark/assets/books.xml --batch-size 1 --cases stringFull,eventObjectFull,rawFrameNameId --output-dir packages/benchmark/results/cross-process/safari-webdriver-books-corpus --json-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-cross-process-books-corpus.json --md-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-cross-process-books-corpus.md',
        },
        {
          id: 'post-safari-audits',
          purpose: 'Classify whether Safari rows close the obligation or create a counterexample.',
          command: 'node packages/benchmark/runtime-proof-coverage-audit.mjs --json-out packages/benchmark/results/release/runtime-proof-coverage-audit.json --md-out packages/benchmark/results/release/runtime-proof-coverage-audit.md && node packages/benchmark/runtime-counterexample-scan.mjs --json-out packages/benchmark/results/release/runtime-counterexample-scan.json --md-out packages/benchmark/results/release/runtime-counterexample-scan.md',
        },
      ],
      expectedEvidence: [
        'Safari/WebKit environment.browserName or javascriptEngine is recognized as safari-jsc-browser by runtime-proof-coverage-audit.',
        'Rows preserve fullStringParity and the same event/checksum contract.',
        'Memory evidence is classified explicitly; missing Safari JS heap counters must not be treated as bounded-memory proof.',
      ],
      scopeGuards: [
        'Safari rows are browser JSC evidence; they do not replace Bun/JSC rows.',
        'A missing or failing safaridriver run is environment evidence only, not a runtime limitation.',
      ],
    });
  }

  if (byId.has('codegen-traces-open')) {
    handoffs.push({
      id: 'spidermonkey-codegen-handoff',
      obligationIds: ['codegen-traces-open'],
      classification: 'EXTERNAL_RUN_REQUIRED',
      proofGoal: 'Capture emitted SpiderMonkey JIT IR, optimized-code, or codegen diagnostics for same-contract Firefox/SpiderMonkey full-string rows.',
      prerequisites: [
        'Diagnostic-capable Firefox build or SpiderMonkey shell built with the required JitSpew/codegen diagnostics enabled.',
        'Set FIREFOX_PATH when using a non-default Firefox build; set SPIDERMONKEY_JS_SHELL, JSSHELL, or JS_SHELL when probing a shell.',
        'Keep checksum parity rows small first, then scale only after dump emission is proven.',
      ],
      commands: [
        {
          id: 'firefox-diagnostic-installed-or-debug-build',
          purpose: 'Run the existing browser diagnostic dump audit against the Firefox build selected by FIREFOX_PATH.',
          command: 'FIREFOX_PATH=/path/to/firefox node packages/benchmark/firefox-spidermonkey-diagnostic-dump-audit.mjs --size-gib 0.0001 --fixture-shape diverse-cycle --diverse-cycle-size 16 --cases rawFrameNameId --output-dir packages/benchmark/results/firefox-spidermonkey-diagnostic-dump-audit --json-out packages/benchmark/results/release/firefox-spidermonkey-diagnostic-dump-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-diagnostic-dump-audit.md',
        },
        {
          id: 'spidermonkey-js-shell-availability',
          purpose: 'Record whether a local SpiderMonkey shell is available for follow-up JIT diagnostics.',
          command: 'SPIDERMONKEY_JS_SHELL=/path/to/js node packages/benchmark/firefox-spidermonkey-js-shell-availability-audit.mjs --json-out packages/benchmark/results/release/firefox-spidermonkey-js-shell-availability-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-js-shell-availability-audit.md',
        },
        {
          id: 'post-spidermonkey-audits',
          purpose: 'Reclassify the codegen obligation after diagnostic artifacts are generated.',
          command: 'node packages/benchmark/runtime-proof-coverage-audit.mjs --json-out packages/benchmark/results/release/runtime-proof-coverage-audit.json --md-out packages/benchmark/results/release/runtime-proof-coverage-audit.md',
        },
      ],
      expectedEvidence: [
        'A release artifact whose objective records emitted Firefox/SpiderMonkey JIT IR, optimized-code, or codegen dump evidence.',
        'The artifact must include the runtime/build identity, diagnostic flags, selected row id, event count, and checksum parity.',
        'The coverage audit must classify the artifact as SpiderMonkey codegen evidence, not merely profiler/source/availability evidence.',
      ],
      scopeGuards: [
        'The existing no-dump diagnostic audit is a negative result for the installed browser build only.',
        'JS shell availability is environment evidence only until a dump or IR artifact is captured.',
      ],
    });
  }

  return handoffs;
}

function createFindings(activeObligations, handoffs, unhandledObligations) {
  return [
    {
      id: 'handoff-scope',
      classification: 'SCOPE_GUARD',
      summary: 'The handoff records next experiments for open proof gaps; it is not itself benchmark, allocation, or codegen evidence.',
      evidence: [
        `activeObligations=${activeObligations.map(row => `${row.id}:${row.status}`).join(', ') || 'none'}`,
        `handoffs=${handoffs.map(row => row.id).join(', ') || 'none'}`,
      ],
    },
    {
      id: 'handoff-coverage',
      classification: unhandledObligations.length === 0 ? 'CONTRACT_FACT' : 'OPEN',
      summary: unhandledObligations.length === 0
        ? 'Every currently active proof obligation has a concrete handoff entry.'
        : 'At least one active proof obligation still lacks a concrete handoff entry.',
      evidence: unhandledObligations.length === 0
        ? ['unhandledObligations=0']
        : unhandledObligations.map(row => `${row.id}: ${row.reason}`),
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Runtime Proof Gap Handoff',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Audit Input',
    '',
    `- Audit JSON: ${report.inputs.auditJson}`,
    `- Audit generated: ${report.inputs.auditGeneratedAt}`,
    `- Active obligations: ${report.auditSummary.activeObligations.length}`,
    '',
    '## Active Obligations',
    '',
  ];

  for (const obligation of report.auditSummary.activeObligations) {
    lines.push(`- ${obligation.id} (${obligation.status}): ${obligation.evidence}`);
    lines.push(`  - Next: ${obligation.nextExperiment}`);
  }

  lines.push('', '## Handoffs', '');
  for (const handoff of report.handoffs) {
    lines.push(`### ${handoff.id}`);
    lines.push('');
    lines.push(`- Classification: ${handoff.classification}`);
    lines.push(`- Obligations: ${handoff.obligationIds.join(', ')}`);
    lines.push(`- Proof goal: ${handoff.proofGoal}`);
    lines.push('');
    lines.push('Prerequisites:');
    for (const prerequisite of handoff.prerequisites) {
      lines.push(`- ${prerequisite}`);
    }
    lines.push('');
    lines.push('Commands:');
    for (const command of handoff.commands) {
      lines.push(`- ${command.id}: ${command.purpose}`);
      lines.push(`  - \`${command.command}\``);
    }
    lines.push('');
    lines.push('Expected evidence:');
    for (const item of handoff.expectedEvidence) {
      lines.push(`- ${item}`);
    }
    lines.push('');
    lines.push('Scope guards:');
    for (const guard of handoff.scopeGuards) {
      lines.push(`- ${guard}`);
    }
    lines.push('');
  }

  if (report.unhandledObligations.length > 0) {
    lines.push('## Unhandled Obligations', '');
    for (const obligation of report.unhandledObligations) {
      lines.push(`- ${obligation.id} (${obligation.status}): ${obligation.reason}`);
    }
    lines.push('');
  }

  lines.push('## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const item of finding.evidence) {
      lines.push(`  - ${item}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function printSummary(report) {
  console.log(`runtime-proof-gap-handoff: handoffs=${report.handoffs.length} unhandled=${report.unhandledObligations.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
