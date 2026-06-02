import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-route-freshness-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-route-freshness-audit.md');
const defaultRoute = 'gecko.v2.mozilla-central.latest.firefox.win64-debug';
const defaultIndexBaseUrl = 'https://firefox-ci-tc.services.mozilla.com/api/index/v1/task';
const selfTestTaskId = 'aJLr1DFjQ7urQTpRiIsfRQ';

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    route: defaultRoute,
    indexBaseUrl: defaultIndexBaseUrl,
    expectedTaskId: null,
    expectedBuildId: null,
    expectedSourceRevision: null,
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
  const report = createReport(options, route);
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

function createReport(options, route) {
  const expected = {
    taskId: options.expectedTaskId,
    buildId: options.expectedBuildId,
    sourceRevision: options.expectedSourceRevision,
  };
  const expectedIdentityMatchesRoute = Boolean(expected.taskId) && route.taskId === expected.taskId;
  const routeFresh = route.status === 'available' && expectedIdentityMatchesRoute;
  const summary = {
    status: routeFresh ? 'fresh' : route.status === 'available' ? 'stale-or-unmatched' : route.status,
    routeFresh,
    expectedIdentityMatchesRoute,
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
