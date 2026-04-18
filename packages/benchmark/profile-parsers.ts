/**
 * Profiling script with flame graph generation for XML parser performance analysis
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import inspector from 'node:inspector';
import { StaxXmlParserSync } from 'stax-xml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ProfileConfig {
  variant: 'baseline' | 'inlined';
  testFile: string;
  duration: number; // in seconds
  method: 'v8-prof' | 'inspector' | 'clinic';
  iterations?: number;
}

interface ProfileResult {
  variant: string;
  testFile: string;
  method: string;
  outputFiles: string[];
  metrics: {
    totalDuration: number;
    iterations: number;
    avgIterationTime: number;
  };
}

// Helper to run parser with profiling
function runParserWithProfiling(
  xml: string,
  parser: typeof StaxXmlParserSync,
  iterations: number
): { duration: number; eventCount: number } {
  const startTime = performance.now();
  let totalEvents = 0;

  for (let i = 0; i < iterations; i++) {
    const p = new parser();
    let eventCount = 0;

    for (const event of p.parse(xml)) {
      eventCount++;
      // Prevent dead code elimination
      if (event.type === 'error') {
        throw new Error('Parse error');
      }
    }

    totalEvents += eventCount;
  }

  const duration = performance.now() - startTime;
  return { duration, eventCount: totalEvents };
}

// Method 1: V8 CPU profiling (--prof flag)
async function profileWithV8Prof(
  config: ProfileConfig,
  xml: string,
  parser: typeof StaxXmlParserSync
): Promise<ProfileResult> {
  console.log(`\nProfiling with V8 --prof method...`);

  const profileDir = path.join(__dirname, 'profiles', 'v8-prof');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  // Create a temporary script that runs the parser
  const scriptPath = path.join(profileDir, `profile-${config.variant}-temp.js`);
  const scriptContent = `
    import { StaxXmlParserSync } from 'stax-xml';

    const xml = ${JSON.stringify(xml)};
    const iterations = ${config.iterations || 100};

    console.log('Starting profiling for ${config.variant} (${iterations} iterations)...');
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const parser = new StaxXmlParserSync();
      for (const event of parser.parse(xml)) {
        if (event.type === 'error') throw new Error('Parse error');
      }
    }

    const duration = Date.now() - startTime;
    console.log(\`Completed in \${duration}ms\`);
  `;

  fs.writeFileSync(scriptPath, scriptContent, 'utf8');

  // Run with --prof flag
  const isolateFile = `isolate-${Date.now()}-v8.log`;
  const result = childProcess.spawnSync(
    process.execPath,
    [
      '--prof',
      '--no-logfile-per-isolate',
      '--logfile', isolateFile,
      scriptPath
    ],
    {
      cwd: profileDir,
      stdio: 'inherit',
      shell: true
    }
  );

  // Process the profile
  const logFile = path.join(profileDir, isolateFile);
  if (fs.existsSync(logFile)) {
    console.log(`Processing profile: ${logFile}`);

    // Generate human-readable profile
    const processResult = childProcess.spawnSync(
      process.execPath,
      ['--prof-process', logFile],
      { cwd: profileDir, encoding: 'utf8', shell: true }
    );

    const outputPath = path.join(profileDir, `${config.variant}-${config.testFile}-processed.txt`);
    fs.writeFileSync(outputPath, processResult.stdout, 'utf8');
    console.log(`Processed profile saved to: ${outputPath}`);

    // Clean up temporary files
    fs.unlinkSync(scriptPath);

    return {
      variant: config.variant,
      testFile: config.testFile,
      method: 'v8-prof',
      outputFiles: [outputPath, logFile],
      metrics: {
        totalDuration: 0,
        iterations: config.iterations || 100,
        avgIterationTime: 0
      }
    };
  }

  throw new Error('Failed to generate V8 profile');
}

// Method 2: Inspector Protocol CPU profiling
async function profileWithInspector(
  config: ProfileConfig,
  xml: string,
  parser: typeof StaxXmlParserSync
): Promise<ProfileResult> {
  console.log(`\nProfiling with Inspector protocol...`);

  const profileDir = path.join(__dirname, 'profiles', 'inspector');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const session = new inspector.Session();
  session.connect();

  // Start profiling
  await new Promise<void>((resolve) => {
    session.post('Profiler.enable', () => {
      session.post('Profiler.start', () => {
        resolve();
      });
    });
  });

  console.log('Profiling started...');
  const iterations = config.iterations || 100;
  const { duration } = runParserWithProfiling(xml, parser, iterations);

  console.log(`Profiling completed in ${duration.toFixed(2)}ms`);

  // Stop profiling and get result
  const profile = await new Promise<any>((resolve, reject) => {
    session.post('Profiler.stop', (err, { profile }) => {
      if (err) reject(err);
      else resolve(profile);
    });
  });

  session.disconnect();

  // Save profile
  const profilePath = path.join(
    profileDir,
    `${config.variant}-${config.testFile}-${Date.now()}.cpuprofile`
  );

  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8');
  console.log(`CPU profile saved to: ${profilePath}`);
  console.log('Open this file in Chrome DevTools > Performance > Load profile');

  // Generate flame graph if speedscope is available
  try {
    console.log('\nTrying to generate flame graph with speedscope...');
    const speedscopeResult = childProcess.spawnSync(
      'npx',
      ['speedscope', profilePath, '-o', profilePath.replace('.cpuprofile', '.speedscope.json')],
      { stdio: 'inherit', shell: true }
    );

    if (speedscopeResult.status === 0) {
      console.log('Flame graph generated successfully!');
    }
  } catch (error) {
    console.log('speedscope not available (optional)');
  }

  return {
    variant: config.variant,
    testFile: config.testFile,
    method: 'inspector',
    outputFiles: [profilePath],
    metrics: {
      totalDuration: duration,
      iterations,
      avgIterationTime: duration / iterations
    }
  };
}

// Method 3: clinic.js profiling (if available)
async function profileWithClinic(
  config: ProfileConfig,
  xml: string,
  parser: typeof StaxXmlParserSync
): Promise<ProfileResult> {
  console.log(`\nProfiling with clinic.js...`);

  const profileDir = path.join(__dirname, 'profiles', 'clinic');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  // Create a temporary script
  const scriptPath = path.join(profileDir, `profile-${config.variant}-temp.js`);
  const scriptContent = `
    import { StaxXmlParserSync } from 'stax-xml';

    const xml = ${JSON.stringify(xml)};
    const iterations = ${config.iterations || 100};

    console.log('Starting clinic profiling for ${config.variant}...');

    for (let i = 0; i < iterations; i++) {
      const parser = new StaxXmlParserSync();
      for (const event of parser.parse(xml)) {
        if (event.type === 'error') throw new Error('Parse error');
      }
    }

    console.log('Profiling completed');
  `;

  fs.writeFileSync(scriptPath, scriptContent, 'utf8');

  // Try to run with clinic flame (for flame graphs)
  try {
    console.log('Running clinic flame...');
    const result = childProcess.spawnSync(
      'npx',
      [
        'clinic',
        'flame',
        '--collect-only',
        '--dest', profileDir,
        '--',
        process.execPath,
        scriptPath
      ],
      {
        cwd: profileDir,
        stdio: 'inherit',
        shell: true
      }
    );

    if (result.status === 0) {
      console.log('Clinic flame profiling completed');

      // Find the generated profile directory
      const profileDirs = fs.readdirSync(profileDir)
        .filter(f => f.endsWith('.clinic-flame'))
        .map(f => path.join(profileDir, f));

      if (profileDirs.length > 0) {
        const latestProfile = profileDirs[profileDirs.length - 1];
        console.log(`Profile directory: ${latestProfile}`);

        // Generate HTML report
        childProcess.spawnSync(
          'npx',
          ['clinic', 'flame', '--visualize-only', latestProfile],
          { stdio: 'inherit', shell: true }
        );

        fs.unlinkSync(scriptPath);

        return {
          variant: config.variant,
          testFile: config.testFile,
          method: 'clinic',
          outputFiles: [latestProfile],
          metrics: {
            totalDuration: 0,
            iterations: config.iterations || 100,
            avgIterationTime: 0
          }
        };
      }
    }
  } catch (error) {
    console.log('clinic.js not available, skipping...');
  }

  throw new Error('clinic.js profiling failed or not available');
}

// Generate side-by-side comparison
function generateComparisonReport(results: ProfileResult[]): string {
  let report = '\n=== PROFILING COMPARISON REPORT ===\n\n';

  report += 'Generated profiles:\n';
  report += '─'.repeat(60) + '\n';

  for (const result of results) {
    report += `\n${result.variant.toUpperCase()} - ${result.testFile}\n`;
    report += `Method: ${result.method}\n`;
    report += `Iterations: ${result.metrics.iterations}\n`;

    if (result.metrics.totalDuration > 0) {
      report += `Total duration: ${result.metrics.totalDuration.toFixed(2)}ms\n`;
      report += `Avg per iteration: ${result.metrics.avgIterationTime.toFixed(2)}ms\n`;
    }

    report += `Output files:\n`;
    for (const file of result.outputFiles) {
      report += `  - ${file}\n`;
    }
  }

  report += '\n\nHow to analyze the profiles:\n';
  report += '─'.repeat(60) + '\n';
  report += '1. V8 profiles (*.txt): Text-based call tree with time percentages\n';
  report += '2. Inspector profiles (*.cpuprofile): Open in Chrome DevTools\n';
  report += '   - Chrome > DevTools > Performance > Load profile\n';
  report += '3. Clinic profiles (*.clinic-flame): HTML flame graphs\n';
  report += '   - Open the .html file in a browser\n';

  report += '\n\nKey metrics to compare:\n';
  report += '─'.repeat(60) + '\n';
  report += '- Hot functions (functions consuming most CPU time)\n';
  report += '- Call stack depth and complexity\n';
  report += '- Time spent in different parsing phases\n';
  report += '- Function call overhead\n';
  report += '- Inlining opportunities and effects\n';

  return report;
}

// Load parser variant
async function loadParser(variant: 'baseline' | 'inlined'): Promise<typeof StaxXmlParserSync> {
  if (variant === 'baseline') {
    try {
      const baselineModule = await import('./../../stax-xml/src/StaxXmlParserSync.baseline.js');
      return baselineModule.StaxXmlParserSync;
    } catch (error) {
      console.warn('Baseline parser not found, using default parser');
      return StaxXmlParserSync;
    }
  }
  return StaxXmlParserSync;
}

// Main profiling execution
async function main() {
  console.log('=== XML Parser Profiling & Flame Graph Generation ===');
  console.log(`Node.js: ${process.version}`);
  console.log(`V8: ${process.versions.v8}\n`);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const variant = (args[0] as 'baseline' | 'inlined') || 'inlined';
  const testFile = args[1] || 'medium-nested.xml';
  const method = (args[2] as 'v8-prof' | 'inspector' | 'clinic') || 'inspector';
  const iterations = parseInt(args[3]) || 100;

  // Load test file
  const testDataPath = path.join(__dirname, 'test-data', testFile);
  if (!fs.existsSync(testDataPath)) {
    console.error(`Test file not found: ${testDataPath}`);
    console.error('Please run generate-test-xmls.ts first');
    process.exit(1);
  }

  const xml = fs.readFileSync(testDataPath, 'utf8');
  console.log(`Test file: ${testFile} (${(Buffer.byteLength(xml) / 1024).toFixed(2)} KB)`);
  console.log(`Variant: ${variant}`);
  console.log(`Method: ${method}`);
  console.log(`Iterations: ${iterations}\n`);

  // Load parser
  const parser = await loadParser(variant);

  const config: ProfileConfig = {
    variant,
    testFile: testFile.replace('.xml', ''),
    duration: 10,
    method,
    iterations
  };

  // Run profiling
  let result: ProfileResult;

  try {
    switch (method) {
      case 'v8-prof':
        result = await profileWithV8Prof(config, xml, parser);
        break;
      case 'inspector':
        result = await profileWithInspector(config, xml, parser);
        break;
      case 'clinic':
        result = await profileWithClinic(config, xml, parser);
        break;
      default:
        throw new Error(`Unknown profiling method: ${method}`);
    }

    console.log('\n✓ Profiling completed successfully!');

    // Save metadata
    const metadataPath = path.join(
      __dirname,
      'profiles',
      `profile-${variant}-${config.testFile}-metadata.json`
    );

    const metadata = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      v8Version: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
      ...result
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`\nMetadata saved to: ${metadataPath}`);

  } catch (error) {
    console.error('Profiling failed:', error);
    process.exit(1);
  }
}

// Profile all variants and generate comparison
async function profileAll() {
  console.log('=== Profiling All Variants ===\n');

  const testFiles = ['small-simple.xml', 'medium-nested.xml', 'large-complex.xml'];
  const variants: ('baseline' | 'inlined')[] = ['baseline', 'inlined'];
  const allResults: ProfileResult[] = [];

  for (const testFile of testFiles) {
    const testPath = path.join(__dirname, 'test-data', testFile);
    if (!fs.existsSync(testPath)) {
      console.log(`Skipping ${testFile} (not found)`);
      continue;
    }

    const xml = fs.readFileSync(testPath, 'utf8');

    for (const variant of variants) {
      console.log(`\nProfiling ${variant} with ${testFile}...`);

      const parser = await loadParser(variant);
      const config: ProfileConfig = {
        variant,
        testFile: testFile.replace('.xml', ''),
        duration: 10,
        method: 'inspector',
        iterations: 50
      };

      try {
        const result = await profileWithInspector(config, xml, parser);
        allResults.push(result);
      } catch (error) {
        console.error(`Failed to profile ${variant} with ${testFile}:`, error);
      }
    }
  }

  // Generate comparison report
  const report = generateComparisonReport(allResults);
  console.log(report);

  const reportPath = path.join(__dirname, 'profiles', 'comparison-report.txt');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\nComparison report saved to: ${reportPath}`);
}

// Run based on command
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const command = process.argv[2];

  if (command === '--all') {
    profileAll().catch(console.error);
  } else {
    main().catch(console.error);
  }
}

export { profileWithInspector, profileWithV8Prof, profileWithClinic, profileAll };
