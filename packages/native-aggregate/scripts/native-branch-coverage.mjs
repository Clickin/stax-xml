import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, '..');
const outputPath = resolve(packageRoot, 'target', 'coverage', 'native-branch-summary.json');

mkdirSync(dirname(outputPath), { recursive: true });

const coverage = spawnSync(
  'cargo',
  [
    '+nightly',
    'llvm-cov',
    '--locked',
    '--lib',
    '--no-default-features',
    '--branch',
    '--json',
    '--summary-only',
    '--output-path',
    outputPath,
  ],
  {
    cwd: packageRoot,
    stdio: 'inherit',
  },
);

if (coverage.error) {
  throw coverage.error;
}
if (coverage.status !== 0) {
  process.exit(coverage.status ?? 1);
}

const report = JSON.parse(readFileSync(outputPath, 'utf8'));
const entries = report.data ?? [];
const files = entries.flatMap((entry) => entry.files ?? []);
const failedFiles = files.filter((file) => {
  const branches = file.summary?.branches;
  return !branches || branches.notcovered !== 0 || branches.covered !== branches.count;
});

for (const file of failedFiles) {
  const branches = file.summary?.branches;
  console.error(
    `Rust branch coverage failed for ${file.filename}: ${branches?.covered ?? 0}/${
      branches?.count ?? 0
    } branches covered, ${branches?.notcovered ?? 'unknown'} missed`,
  );
}

const total = entries[0]?.totals?.branches;
if (!total || total.notcovered !== 0 || total.covered !== total.count || failedFiles.length > 0) {
  if (total) {
    console.error(
      `Rust native branch coverage total: ${total.covered}/${total.count} (${total.percent.toFixed(
        2,
      )}%), ${total.notcovered} missed`,
    );
  }
  process.exit(1);
}

console.log(
  `Rust native branch coverage: ${total.covered}/${total.count} (${total.percent.toFixed(2)}%)`,
);
