import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const args = new Set(process.argv.slice(2));
const fail = args.has('--fail');
const minimum = 83;

const coveragePath = resolve('coverage/coverage-final.json');
const coverage = JSON.parse(readFileSync(coveragePath, 'utf8'));
const cwd = process.cwd().replaceAll(sep, '/');

const rows = Object.entries(coverage)
  .map(([file, data]) => branchRow(file, data))
  .filter(row => row.total > 0)
  .sort((left, right) => left.percent - right.percent || left.file.localeCompare(right.file));

for (const row of rows) console.log(`${row.percent.toFixed(2)}% ${row.covered}/${row.total} ${row.file}`);

const covered = rows.reduce((sum, row) => sum + row.covered, 0);
const total = rows.reduce((sum, row) => sum + row.total, 0);
const percent = total === 0 ? 100 : (covered / total) * 100;
const status = percent >= minimum ? 'PASS' : 'FAIL';
console.log(`${status} ${percent.toFixed(2)}% ${covered}/${total} overall (minimum ${minimum}%).`);

if (fail && percent < minimum) {
  console.error(`branch coverage gate failed: ${percent.toFixed(2)}% is below ${minimum}%.`);
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
