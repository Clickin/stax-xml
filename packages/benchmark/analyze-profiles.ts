/**
 * Analyze CPU profile data to identify hot functions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ProfileNode {
  id: number;
  callFrame: {
    functionName: string;
    scriptId: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  hitCount: number;
  children?: number[];
  positionTicks?: Array<{ line: number; ticks: number }>;
}

interface CPUProfile {
  nodes: ProfileNode[];
  startTime: number;
  endTime: number;
  samples?: number[];
  timeDeltas?: number[];
}

function analyzeProfile(profilePath: string) {
  console.log(`\nAnalyzing: ${path.basename(profilePath)}`);
  console.log('='.repeat(80));

  const profile: CPUProfile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

  // Calculate total hits per function
  const functionHits = new Map<string, { hits: number; node: ProfileNode }>();

  for (const node of profile.nodes) {
    if (node.hitCount > 0) {
      const funcName = node.callFrame.functionName || '(anonymous)';
      const key = funcName;

      const existing = functionHits.get(key);
      if (existing) {
        existing.hits += node.hitCount;
      } else {
        functionHits.set(key, { hits: node.hitCount, node });
      }
    }
  }

  // Sort by hits (hottest functions first)
  const sorted = Array.from(functionHits.entries())
    .sort((a, b) => b[1].hits - a[1].hits)
    .slice(0, 30);

  const totalHits = sorted.reduce((sum, [, data]) => sum + data.hits, 0);

  console.log(`\nTop 30 Hottest Functions (Total samples: ${totalHits})`);
  console.log('-'.repeat(80));
  console.log('Rank'.padEnd(6) + 'Samples'.padEnd(10) + '%'.padEnd(8) + 'Function Name');
  console.log('-'.repeat(80));

  sorted.forEach(([funcName, data], index) => {
    const percentage = ((data.hits / totalHits) * 100).toFixed(2);
    console.log(
      `${(index + 1).toString().padEnd(6)}${data.hits.toString().padEnd(10)}${percentage.padEnd(8)}${funcName}`
    );
  });

  console.log('-'.repeat(80));

  // Find parser-specific functions
  console.log('\n Parser-Specific Functions:');
  console.log('-'.repeat(80));

  const parserFunctions = sorted.filter(([funcName]) =>
    funcName.includes('parse') ||
    funcName.includes('find') ||
    funcName.includes('match') ||
    funcName.includes('trim') ||
    funcName.includes('Char') ||
    funcName.includes('Entity') ||
    funcName.includes('Event') ||
    funcName.includes('Xml')
  );

  parserFunctions.forEach(([funcName, data]) => {
    const percentage = ((data.hits / totalHits) * 100).toFixed(2);
    console.log(`  ${data.hits.toString().padEnd(8)} (${percentage.padEnd(6)}%) ${funcName}`);
  });

  return { totalHits, functionHits, sorted };
}

function compareProfiles(baselinePath: string, inlinedPath: string) {
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('COMPARISON: Baseline vs Inlined');
  console.log('='.repeat(80));

  const baselineProfile: CPUProfile = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const inlinedProfile: CPUProfile = JSON.parse(fs.readFileSync(inlinedPath, 'utf8'));

  const baselineTime = baselineProfile.endTime - baselineProfile.startTime;
  const inlinedTime = inlinedProfile.endTime - inlinedProfile.startTime;

  console.log(`\nTotal Time:`);
  console.log(`  Baseline: ${(baselineTime / 1000000).toFixed(2)} ms`);
  console.log(`  Inlined:  ${(inlinedTime / 1000000).toFixed(2)} ms`);
  console.log(`  Difference: ${(((inlinedTime - baselineTime) / baselineTime) * 100).toFixed(2)}%`);

  const baselineSamples = baselineProfile.samples?.length || 0;
  const inlinedSamples = inlinedProfile.samples?.length || 0;

  console.log(`\nTotal Samples:`);
  console.log(`  Baseline: ${baselineSamples}`);
  console.log(`  Inlined:  ${inlinedSamples}`);
  console.log(`  Difference: ${(((inlinedSamples - baselineSamples) / baselineSamples) * 100).toFixed(2)}%`);
}

async function main() {
  const profilesDir = path.join(__dirname, 'profiles');

  const profiles = fs.readdirSync(profilesDir)
    .filter(f => f.endsWith('.cpuprofile'))
    .sort()
    .reverse()
    .slice(0, 2);

  if (profiles.length < 2) {
    console.error('Need at least 2 profile files. Run profiling first.');
    process.exit(1);
  }

  console.log('Found profiles:');
  profiles.forEach(p => console.log(`  - ${p}`));

  const baselineProfile = profiles.find(p => p.includes('baseline'));
  const inlinedProfile = profiles.find(p => p.includes('inlined'));

  if (!baselineProfile || !inlinedProfile) {
    console.error('Could not find both baseline and inlined profiles');
    process.exit(1);
  }

  const baselinePath = path.join(profilesDir, baselineProfile);
  const inlinedPath = path.join(profilesDir, inlinedProfile);

  // Analyze each profile
  const baselineResults = analyzeProfile(baselinePath);
  const inlinedResults = analyzeProfile(inlinedPath);

  // Compare
  compareProfiles(baselinePath, inlinedPath);

  console.log('\n\n=== Insights ===');
  console.log('1. Check which functions appear in inlined but not baseline (or vice versa)');
  console.log('2. Look for functions with significantly different sample counts');
  console.log('3. Identify if inlined functions are being JIT-compiled differently');
  console.log('4. Compare memory allocation patterns (use --prof-heap for detailed analysis)');
  console.log('\nTo view flame graphs:');
  console.log('1. Open Chrome and go to: chrome://inspect');
  console.log('2. Click "Open dedicated DevTools for Node"');
  console.log('3. Go to Profiler tab and load the .cpuprofile files');
  console.log('4. Compare the flame graphs visually');
}

main().catch(console.error);
