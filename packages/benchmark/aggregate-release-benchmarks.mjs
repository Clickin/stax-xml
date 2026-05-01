import { aggregateReleaseBenchmarks } from './update-release-benchmarks.mjs';

const includeStress = process.argv.includes('--include-stress');
const skipHistory = process.argv.includes('--skip-history');

await aggregateReleaseBenchmarks({
  includeStress,
  history: !skipHistory,
});
