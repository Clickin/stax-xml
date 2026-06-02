import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-route-freshness-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-route-freshness-audit.md');
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultRoute = 'gecko.v2.mozilla-central.latest.firefox.win64-debug';
const defaultIndexBaseUrl = 'https://firefox-ci-tc.services.mozilla.com/api/index/v1/task';
const selfTestTaskId = 'aJLr1DFjQ7urQTpRiIsfRQ';
const taskclusterEvidenceArtifacts = [
  'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json',
  'spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json',
  'spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json',
  'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json',
  'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    route: defaultRoute,
    indexBaseUrl: defaultIndexBaseUrl,
    expectedTaskId: null,
    expectedBuildId: null,
    expectedSourceRevision: null,
    releaseDir: defaultReleaseDir,
    selfTest: false,
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
      case '--route':
        options.route = readValue();
        break;
      case '--index-base-url':
        options.indexBaseUrl = readValue().replace(/\/$/, '');
        break;
      case '--expected-task-id':
        options.expectedTaskId = readValue();
        break;
      case '--expected-build-id':
        options.expectedBuildId = readValue();
        break;
      case '--expected-source-revision':
        options.expectedSourceRevision = readValue();
        break;
      case '--release-dir':
        options.releaseDir = resolve(process.cwd(), readValue());
        break;
      case '--self-test':
        options.selfTest = true;
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

async function main() {
  const options = parseArgs();
  const route = options.selfTest ? createSelfTestRoute(options) : await fetchRoute(options);
  const artifacts = readTaskclusterEvidenceArtifacts(options, route);
  const report = createReport(options, route, artifacts);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`${report.objective}: status=${report.summary.status} routeFresh=${report.summary.routeFresh} taskId=${report.route.taskId ?? 'unknown'}`);
}

function createSelfTestRoute(options) {
  return {
    status: 'available',
    route: options.route,
    taskId: selfTestTaskId,
    fetchedAt: new Date('2026-06-02T00:00:00.000Z').toISOString(),
    indexUrl: `${options.indexBaseUrl}/${encodeURIComponent(options.route)}`,
    error: null,
  };
}

async function fetchRoute(options) {
  const indexUrl = `${options.indexBaseUrl}/${encodeURIComponent(options.route)}`;
  try {
    const response = await fetch(indexUrl);
    const bodyText = await response.text();
    if (!response.ok) {
      return {
        status: 'fetch-failed',
        route: options.route,
        taskId: null,
        fetchedAt: new Date().toISOString(),
        indexUrl,
        error: `HTTP ${response.status}: ${bodyText.slice(0, 500)}`,
      };
    }
    const payload = JSON.parse(bodyText);
    return {
      status: typeof payload.taskId === 'string' && payload.taskId.length > 0 ? 'available' : 'missing-task-id',
      route: options.route,
      taskId: typeof payload.taskId === 'string' ? payload.taskId : null,
      fetchedAt: new Date().toISOString(),
      indexUrl,
      error: null,
    };
  } catch (error) {
    return {
      status: 'fetch-failed',
      route: options.route,
      taskId: null,
      fetchedAt: new Date().toISOString(),
      indexUrl,
      error: error?.message ?? String(error),
    };
  }
}

function readTaskclusterEvidenceArtifacts(options, route) {
  return taskclusterEvidenceArtifacts.map(sourceArtifact => {
    const filePath = join(options.releaseDir, sourceArtifact);
    if (!existsSync(filePath)) {
      return {
        sourceArtifact,
        status: 'missing',
        taskId: null,
        buildId: null,
        sourceRevision: null,
        matchesRoute: false,
        matchesExpectedBuildIdentity: false,
      };
    }
    try {
      const root = JSON.parse(readFileSync(filePath, 'utf8'));
      const provenance = root?.shell?.provenance ?? {};
      const buildId = provenance.buildId ?? provenance.targetTxt?.buildId ?? provenance.buildhub?.buildId ?? null;
      const sourceRevision = provenance.sourceRevision ?? provenance.targetTxt?.sourceRevision ?? provenance.buildhub?.sourceRevision ?? null;
      return {
        sourceArtifact,
        status: 'loaded',
        taskId: provenance.taskId ?? null,
        buildId,
        sourceRevision,
        matchesRoute: route.status === 'available' && provenance.taskId === route.taskId,
        matchesExpectedBuildIdentity: provenance.taskId === options.expectedTaskId
          && buildId === options.expectedBuildId
          && sourceRevision === options.expectedSourceRevision,
      };
    } catch (error) {
      return {
        sourceArtifact,
        status: 'parse-error',
        taskId: null,
        buildId: null,
        sourceRevision: null,
        matchesRoute: false,
        matchesExpectedBuildIdentity: false,
        error: error?.message ?? String(error),
      };
    }
  });
}

function createReport(options, route, artifacts) {
  const expected = {
    taskId: options.expectedTaskId,
    buildId: options.expectedBuildId,
    sourceRevision: options.expectedSourceRevision,
  };
  const expectedIdentityMatchesRoute = Boolean(expected.taskId) && route.taskId === expected.taskId;
  const checkedArtifacts = artifacts.filter(artifact => artifact.status === 'loaded');
  const mismatchedArtifacts = artifacts
    .filter(artifact => artifact.status !== 'loaded' || !artifact.matchesRoute || !artifact.matchesExpectedBuildIdentity)
    .map(artifact => artifact.sourceArtifact);
  const artifactIdentityMatchesRoute = artifacts.length > 0 && checkedArtifacts.length === artifacts.length && mismatchedArtifacts.length === 0;
  const routeFresh = route.status === 'available' && expectedIdentityMatchesRoute;
  const summary = {
    status: routeFresh ? 'fresh' : route.status === 'available' ? 'stale-or-unmatched' : route.status,
    routeFresh,
    expectedIdentityMatchesRoute,
    artifactIdentityMatchesRoute,
    checkedArtifactCount: checkedArtifacts.length,
    mismatchedArtifacts,
    hasExpectedBuildIdentity: Boolean(expected.buildId && expected.sourceRevision),
    conclusionAllowed: false,
  };

  return {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-taskcluster-debug-jsshell-route-freshness-audit',
    contract: 'taskcluster-latest-route-current-debug-jsshell-identity-freshness',
    note: 'Resolves the Taskcluster latest win64-debug route and checks whether the current SpiderMonkey debug js-shell evidence still names that route task. This is route freshness evidence only; it is not benchmark, codegen, or same-contract StAX closure evidence.',
    route,
    expected,
    artifacts,
    summary,
    findings: [
      {
        id: 'taskcluster-latest-route-resolved',
        classification: 'ENVIRONMENT_FACT',
        summary: `Route ${route.route} resolved with status=${route.status} taskId=${route.taskId ?? 'unknown'}.`,
      },
      {
        id: 'route-freshness-scope-guard',
        classification: 'SCOPE_GUARD',
        summary: 'Route freshness proves only that current Taskcluster evidence points at the latest route task; it cannot close emitted-IR or same-contract StAX obligations.',
      },
      {
        id: 'taskcluster-evidence-artifact-identity',
        classification: 'SCOPE_GUARD',
        summary: `Checked ${checkedArtifacts.length} Taskcluster evidence artifacts against the route and expected build identity; mismatches=${mismatchedArtifacts.length}.`,
      },
    ],
  };
}

function renderMarkdown(report) {
  return [
    '# SpiderMonkey Taskcluster Debug JS Shell Route Freshness Audit',
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.summary.status}`,
    `- Route fresh: ${report.summary.routeFresh}`,
    `- Expected identity matches route: ${report.summary.expectedIdentityMatchesRoute}`,
    `- Artifact identity matches route: ${report.summary.artifactIdentityMatchesRoute}`,
    `- Checked artifacts: ${report.summary.checkedArtifactCount}`,
    `- Mismatched artifacts: ${report.summary.mismatchedArtifacts.length ? report.summary.mismatchedArtifacts.join(', ') : 'none'}`,
    `- Has expected build identity: ${report.summary.hasExpectedBuildIdentity}`,
    `- Runtime-limit conclusion allowed: ${report.summary.conclusionAllowed}`,
    '',
    '## Route',
    '',
    `- Route: ${report.route.route}`,
    `- Index URL: ${report.route.indexUrl}`,
    `- Task ID: ${report.route.taskId ?? 'unknown'}`,
    `- Fetch status: ${report.route.status}`,
    `- Fetched at: ${report.route.fetchedAt}`,
    report.route.error ? `- Error: ${report.route.error}` : null,
    '',
    '## Expected Evidence Identity',
    '',
    `- Task ID: ${report.expected.taskId ?? 'unknown'}`,
    `- Build ID: ${report.expected.buildId ?? 'unknown'}`,
    `- Source revision: ${report.expected.sourceRevision ?? 'unknown'}`,
    '',
    '## Evidence Artifacts',
    '',
    '| Artifact | Status | Task ID | Build ID | Source revision | Matches route | Matches expected build identity |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...report.artifacts.map(artifact => `| \`${artifact.sourceArtifact}\` | ${artifact.status} | ${artifact.taskId ?? 'unknown'} | ${artifact.buildId ?? 'unknown'} | ${artifact.sourceRevision ?? 'unknown'} | ${artifact.matchesRoute} | ${artifact.matchesExpectedBuildIdentity} |`),
    '',
    '## Findings',
    '',
    ...report.findings.map(finding => `- ${finding.id} (${finding.classification}): ${finding.summary}`),
    '',
  ].filter(line => line !== null).join('\n');
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

main().catch(error => {
  console.error(error?.stack ?? error?.message ?? String(error));
  process.exitCode = 1;
});
