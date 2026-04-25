import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const args = new Set(process.argv.slice(2));
const fail = args.has('--fail');

const coveragePath = resolve('coverage/coverage-final.json');
const coverage = JSON.parse(readFileSync(coveragePath, 'utf8'));
const cwd = process.cwd().replaceAll(sep, '/');

const rows = Object.entries(coverage)
  .map(([file, data]) => branchRow(file, data))
  .filter(row => row.total > 0)
  .sort((left, right) => left.percent - right.percent || left.file.localeCompare(right.file));

for (const row of rows) {
  const status = row.covered === row.total ? 'PASS' : 'FAIL';
  console.log(`${status} ${row.percent.toFixed(2)}% ${row.covered}/${row.total} ${row.file}`);
}

const failures = rows.filter(row => row.covered < row.total);
if (fail && failures.length > 0) {
  console.error(`branch coverage gate failed: ${failures.length} file(s) below 100%.`);
  process.exit(1);
}

function branchRow(file, data) {
  let covered = 0;
  let total = 0;

  for (const branchHits of Object.values(data.b ?? {})) {
    total += branchHits.length;
    covered += branchHits.filter(hit => hit > 0).length;
  }

  const normalizedFile = file.replaceAll('\\', '/');
  const relativeFile = normalizedFile.startsWith(`${cwd}/`)
    ? normalizedFile.slice(cwd.length + 1)
    : normalizedFile;

  return {
    file: relativeFile,
    covered,
    total,
    percent: total === 0 ? 100 : (covered / total) * 100,
  };
}
