/**
 * Unified large-file stream reader benchmark harness.
 *
 * Compares stax-xml (Node.js), Woodstox (Java), and quick-xml (Rust)
 * on large row-like XML fixtures (10GB/20GB/30GB).
 *
 * Each implementation streams rows one at a time, simulates preparing
 * a DB insert, and discards the row object before moving on.
 *
 * Metrics collected: wall time, throughput (MiB/s), peak RSS, peak heap (where available).
 */
import { execFile, execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const WOODSTOX_JAR = join(process.env.HOME, '.m2/repository/com/fasterxml/woodstox/woodstox-core/6.7.0/woodstox-core-6.7.0.jar');
const STAX2_JAR = join(process.env.HOME, '.m2/repository/org/codehaus/woodstox/stax2-api/4.2.2/stax2-api-4.2.2.jar');
const JAVA_CLASS_DIR = join(__dirname, 'cross-runtime', 'reader-woodstox', 'large-classes');
const RUST_MANIFEST = join(__dirname, 'cross-runtime', 'reader-quickxml-large', 'Cargo.toml');
const FIXTURE_DIR = join(__dirname, 'assets', 'large');

const SIZES_GIB = [10, 20, 30];

function formatBytes(bytes) {
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(2)} GiB`;
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

function formatMiB(bytes) {
  return `${(bytes / MIB).toFixed(2)} MiB`;
}

async function fileExists(path) {
  return existsSync(path);
}

async function generateFixture(sizeGib) {
  const outputPath = join(FIXTURE_DIR, `database-${sizeGib}gib.xml`);
  if (existsSync(outputPath)) {
    console.log(`Fixture ${sizeGib} GiB already exists: ${outputPath}`);
    return outputPath;
  }

  console.log(`\nGenerating ${sizeGib} GiB fixture...`);
  const start = Date.now();
  execFileSync('node', [
    join(__dirname, 'generate-large-xml.mjs'),
    `--size-gib=${sizeGib}`,
    `--output=${FIXTURE_DIR}`,
  ], { stdio: 'inherit' });
  const elapsed = (Date.now() - start) / 1000;
  console.log(`Generated ${sizeGib} GiB fixture in ${elapsed.toFixed(1)}s`);
  return outputPath;
}

function compileJava() {
  if (existsSync(join(JAVA_CLASS_DIR, 'XmlReaderBenchLarge.class'))) return;
  mkdirSync(JAVA_CLASS_DIR, { recursive: true });
  console.log('Compiling Java benchmark...');
  execFileSync('javac', [
    '-cp', `${WOODSTOX_JAR}:${STAX2_JAR}`,
    '-d', JAVA_CLASS_DIR,
    join(__dirname, 'cross-runtime', 'reader-woodstox', 'XmlReaderBenchLarge.java'),
  ], { stdio: 'inherit' });
}

function compileRust() {
  console.log('Building Rust benchmark (release)...');
  execFileSync('cargo', [
    'build',
    '--release',
    '--offline',
    '--manifest-path', RUST_MANIFEST,
  ], { stdio: 'inherit' });
}

async function sampleRss(pid) {
  return new Promise((resolve) => {
    execFile('ps', ['-o', 'rss=', '-p', String(pid)], (err, stdout) => {
      if (err) return resolve(0);
      const kb = parseInt(stdout.trim(), 10);
      resolve(Number.isNaN(kb) ? 0 : kb * 1024);
    });
  });
}

async function runWithRssSampling(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stdout = '';
    let stderr = '';
    let peakRss = 0;
    let finished = false;

    child.stdout.on('data', (data) => { stdout += data.toString('utf8'); });
    child.stderr.on('data', (data) => { stderr += data.toString('utf8'); });

    const interval = setInterval(async () => {
      if (child.pid && !finished) {
        const rss = await sampleRss(child.pid);
        if (rss > peakRss) peakRss = rss;
      }
    }, 100);

    child.on('error', (err) => {
      clearInterval(interval);
      reject(err);
    });

    child.on('close', (code) => {
      finished = true;
      clearInterval(interval);
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), peakRss });
      }
    });
  });
}

async function runJs(filePath, runs = 1, warmups = 0) {
  console.log('  Running stax-xml (Node.js)...');
  const output = execFileSync('node', [
    '--expose-gc',
    join(__dirname, 'stream-reader-large.mjs'),
    `--file=${filePath}`,
    `--runs=${runs}`,
    `--warmups=${warmups}`,
  ], { encoding: 'utf8' });

  // The script prints summary; parse the JSON report from stdout if present, otherwise read it.
  // For simplicity, we run with --json-out and read the file.
  const reportPath = join(__dirname, 'results', 'tmp', `stax-large-${Date.now()}.json`);
  mkdirSync(dirname(reportPath), { recursive: true });
  execFileSync('node', [
    '--expose-gc',
    join(__dirname, 'stream-reader-large.mjs'),
    `--file=${filePath}`,
    `--runs=${runs}`,
    `--warmups=${warmups}`,
    `--json-out=${reportPath}`,
  ], { encoding: 'utf8' });

  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const sample = report.samples[report.samples.length - 1];
  return {
    rows: sample.rowCount,
    events: sample.eventCount,
    checksum: sample.checksum,
    wallTimeSec: sample.wallTimeMs / 1000,
    throughputMiBps: sample.throughputMiBps,
    peakRss: report.peakRss,
    peakHeap: report.peakHeap,
  };
}

async function runJava(filePath, fileSize, runs = 1, warmups = 0) {
  console.log('  Running Woodstox (Java)...');
  compileJava();
  const classpath = `${JAVA_CLASS_DIR}:${WOODSTOX_JAR}:${STAX2_JAR}`;
  const { stdout, peakRss } = await runWithRssSampling('java', [
    '-cp', classpath,
    '-Xmx8g',
    'XmlReaderBenchLarge',
    filePath,
    String(warmups),
    String(runs),
  ]);
  const report = JSON.parse(stdout.split('\n').at(-1));
  const sample = report.samples[report.samples.length - 1];
  return {
    rows: sample.rows,
    events: sample.events,
    checksum: sample.checksum,
    wallTimeSec: sample.seconds,
    throughputMiBps: (fileSize / MIB) / sample.seconds,
    peakRss,
    peakHeap: sample.peakHeapUsed,
  };
}

async function runRust(filePath, fileSize, runs = 1, warmups = 0) {
  console.log('  Running quick-xml (Rust)...');
  compileRust();
  const binary = join(__dirname, 'cross-runtime', 'reader-quickxml-large', 'target', 'release', 'stax_xml_reader_quickxml_large');
  const { stdout, peakRss } = await runWithRssSampling(binary, [
    filePath,
    String(warmups),
    String(runs),
    String(MIB), // buffer size
  ]);
  const report = JSON.parse(stdout.split('\n').at(-1));
  const sample = report.samples[report.samples.length - 1];
  return {
    rows: sample.rows,
    events: sample.events,
    checksum: sample.checksum,
    wallTimeSec: sample.seconds,
    throughputMiBps: (fileSize / MIB) / sample.seconds,
    peakRss: Math.max(peakRss, sample.peakRssKiB * 1024),
    peakHeap: null,
  };
}

import { readFileSync, statSync } from 'node:fs';

async function runAll() {
  const args = process.argv.slice(2);
  const sizesArg = args.find(a => a.startsWith('--sizes='));
  const runsArg = args.find(a => a.startsWith('--runs='));
  const warmupsArg = args.find(a => a.startsWith('--warmups='));

  const sizes = sizesArg
    ? sizesArg.split('=')[1].split(',').map(Number)
    : SIZES_GIB;
  const runs = runsArg ? parseInt(runsArg.split('=')[1], 10) : 1;
  const warmups = warmupsArg ? parseInt(warmupsArg.split('=')[1], 10) : 0;

  mkdirSync(FIXTURE_DIR, { recursive: true });
  mkdirSync(join(__dirname, 'results', 'large-cross-runtime'), { recursive: true });

  const results = [];

  for (const sizeGib of sizes) {
    const filePath = await generateFixture(sizeGib);
    const fileSize = statSync(filePath).size;

    console.log(`\n=== ${sizeGib} GiB fixture (${formatBytes(fileSize)}) ===`);

    const jsResult = await runJs(filePath, runs, warmups);
    const javaResult = await runJava(filePath, fileSize, runs, warmups);
    const rustResult = await runRust(filePath, fileSize, runs, warmups);

    results.push({
      sizeGib,
      fileSize,
      staxXml: jsResult,
      woodstox: javaResult,
      quickXml: rustResult,
    });

    // Verify checksum parity
    if (jsResult.checksum !== javaResult.checksum || jsResult.checksum !== rustResult.checksum) {
      console.warn(`  WARNING: checksum mismatch at ${sizeGib} GiB!`);
      console.warn(`    stax-xml: ${jsResult.checksum}`);
      console.warn(`    woodstox: ${javaResult.checksum}`);
      console.warn(`    quick-xml: ${rustResult.checksum}`);
    }
  }

  // Save report
  const reportPath = join(__dirname, 'results', 'large-cross-runtime', `report-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    environment: {
      runtime: `Node ${process.version}`,
      platform: process.platform,
      arch: process.arch,
    },
    results,
  }, null, 2));

  // Print summary table
  console.log('\n' + '='.repeat(100));
  console.log('Large XML Stream Reader Cross-Runtime Summary');
  console.log('='.repeat(100));
  console.log('');

  for (const r of results) {
    console.log(`## ${r.sizeGib} GiB fixture (${formatBytes(r.fileSize)})`);
    console.log('');
    console.log('| Reader | Wall Time | Throughput | Rows | Peak RSS | Peak Heap | Checksum |');
    console.log('| --- | --- | --- | --- | --- | --- | --- |');

    const row = (name, data) => {
      return `| ${name} | ${data.wallTimeSec.toFixed(2)} s | ${data.throughputMiBps.toFixed(2)} MiB/s | ${data.rows.toLocaleString()} | ${formatMiB(data.peakRss)} | ${data.peakHeap ? formatMiB(data.peakHeap) : 'n/a'} | ${data.checksum} |`;
    };

    console.log(row('stax-xml (Node.js)', r.staxXml));
    console.log(row('Woodstox (Java)', r.woodstox));
    console.log(row('quick-xml (Rust)', r.quickXml));
    console.log('');
  }

  console.log(`Full report saved to: ${reportPath}`);
}

runAll().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
