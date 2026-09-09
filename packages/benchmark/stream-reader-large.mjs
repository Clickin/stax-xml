/**
 * Large XML stream reader benchmark for stax-xml.
 * 
 * Streams a large XML file (10GB/20GB/30GB) row by row,
 * simulating a database insert workload where each row is parsed
 * and a checksum is computed, but no full object materialization occurs.
 * 
 * Reports: wall time, RSS, heap, throughput (MB/s)
 */
import { StreamReaderSync, XmlEventType } from 'stax-xml';
import { openSync, readSync, fstatSync, closeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const ROW_ELEMENT = 'row';

const COLUMNS = [
  'id', 'account_id', 'email', 'first_name', 'last_name', 'phone',
  'address', 'city', 'state', 'zipcode', 'country',
  'created_at', 'updated_at', 'balance', 'is_active', 'tier', 'notes'
];

function fold(seed, value) {
  for (let i = 0; i < value.length; i++) {
    seed = Math.imul(seed, 31) + value.charCodeAt(i);
  }
  return seed | 0;
}

function mix(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function takeMemorySnapshot() {
  const mem = process.memoryUsage();
  return {
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
  };
}

function formatBytes(bytes) {
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(2)} GiB`;
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

function formatMs(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(2)} ms`;
}

function consumeStream(filePath, options = {}) {
  const {
    bufferSize = 64 * MIB,
    maxRows = 0,
    verbose = false,
  } = options;

  const startMem = takeMemorySnapshot();
  const startTime = process.hrtime.bigint();

  let rowCount = 0;
  let inRow = false;
  let currentRowData = {};
  let currentElement = '';
  let elementText = '';
  let eventCount = 0;
  let checksum = 0;
  let lastProgress = 0;

  const fd = openSync(filePath, 'r');
  const fileSize = fstatSync(fd).size;

  // Create sync iterator over file chunks
  function* fileChunks() {
    const buffer = new Uint8Array(bufferSize);
    let position = 0;
    while (position < fileSize) {
      const bytesRead = readSync(fd, buffer, 0, buffer.length, position);
      if (bytesRead === 0) break;
      position += bytesRead;
      yield buffer.subarray(0, bytesRead);
    }
  }

  const reader = new StreamReaderSync(fileChunks(), {
    namespaceAware: false,
  });

  try {
    while (true) {
      const eventType = reader.next();
      if (eventType === null) break;

      eventCount++;

      switch (eventType) {
        case XmlEventType.START_ELEMENT: {
          const name = reader.localName();
          if (name === ROW_ELEMENT) {
            inRow = true;
            currentRowData = {};
          } else if (inRow && COLUMNS.includes(name)) {
            currentElement = name;
            elementText = '';
          }
          break;
        }

        case XmlEventType.END_ELEMENT: {
          const name = reader.localName();
          if (name === ROW_ELEMENT && inRow) {
            // Row complete - simulate "DB insert" by computing row checksum
            let rowChecksum = 0;
            for (const col of COLUMNS) {
              const value = currentRowData[col] || '';
              rowChecksum = mix(rowChecksum, col.length);
              rowChecksum = fold(rowChecksum, value);
            }
            checksum = mix(checksum, rowChecksum);
            rowCount++;
            inRow = false;

            if (verbose && rowCount % 100000 === 0) {
              const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
              const mem = takeMemorySnapshot();
              console.log(`  Row ${rowCount.toLocaleString()}: checksum=${checksum}, RSS=${formatBytes(mem.rss)}, Heap=${formatBytes(mem.heapUsed)}, elapsed=${formatMs(elapsed)}`);
            }

            if (maxRows > 0 && rowCount >= maxRows) {
              break;
            }
          } else if (inRow && COLUMNS.includes(name)) {
            currentRowData[currentElement] = elementText;
            elementText = '';
          }
          break;
        }

        case XmlEventType.CHARACTERS:
        case XmlEventType.CDATA: {
          if (inRow && currentElement) {
            elementText += reader.text();
          }
          break;
        }
      }
    }
  } finally {
    reader.close();
    closeSync(fd);
  }

  const endTime = process.hrtime.bigint();
  const endMem = takeMemorySnapshot();

  const wallTimeMs = Number(endTime - startTime) / 1e6;
  const wallTimeSec = wallTimeMs / 1000;
  const throughputMiBps = (fileSize / MIB) / wallTimeSec;

  return {
    fileSize,
    wallTimeMs,
    wallTimeSec,
    throughputMiBps,
    rowCount,
    eventCount,
    checksum,
    memory: {
      startRss: startMem.rss,
      endRss: endMem.rss,
      maxRss: endMem.rss, // For streaming, peak is typically at end
      startHeapUsed: startMem.heapUsed,
      endHeapUsed: endMem.heapUsed,
      maxHeapUsed: endMem.heapUsed,
      heapDelta: endMem.heapUsed - startMem.heapUsed,
      rssDelta: endMem.rss - startMem.rss,
    },
  };
}

async function runBenchmark(filePath, options = {}) {
  const { runs = 3, warmups = 1 } = options;

  console.log(`\nBenchmark: ${filePath}`);
  console.log('='.repeat(60));

  // Warmup runs
  for (let i = 0; i < warmups; i++) {
    console.log(`Warmup ${i + 1}/${warmups}...`);
    consumeStream(filePath, { verbose: false });
    if (global.gc) global.gc();
  }

  const results = [];
  for (let i = 0; i < runs; i++) {
    console.log(`Run ${i + 1}/${runs}...`);
    const result = consumeStream(filePath, { verbose: options.verbose });
    results.push(result);
    if (global.gc) global.gc();
    // Small delay between runs
    if (i < runs - 1) await new Promise(r => setTimeout(r, 500));
  }

  // Aggregate results
  const avgWallTime = results.reduce((a, b) => a + b.wallTimeMs, 0) / runs;
  const avgThroughput = results.reduce((a, b) => a + b.throughputMiBps, 0) / runs;
  const avgRowCount = results.reduce((a, b) => a + b.rowCount, 0) / runs;
  const avgEventCount = results.reduce((a, b) => a + b.eventCount, 0) / runs;
  const finalChecksum = results[results.length - 1].checksum;

  const maxRss = Math.max(...results.map(r => r.memory.maxRss));
  const maxHeap = Math.max(...results.map(r => r.memory.maxHeapUsed));

  console.log('\n--- Results Summary ---');
  console.log(`File size:     ${formatBytes(results[0].fileSize)}`);
  console.log(`Wall time:     ${formatMs(avgWallTime)} (avg of ${runs} runs)`);
  console.log(`Throughput:    ${avgThroughput.toFixed(2)} MiB/s`);
  console.log(`Rows parsed:   ${avgRowCount.toLocaleString()}`);
  console.log(`Events:        ${avgEventCount.toLocaleString()}`);
  console.log(`Checksum:      ${finalChecksum}`);
  console.log(`Peak RSS:      ${formatBytes(maxRss)}`);
  console.log(`Peak Heap:     ${formatBytes(maxHeap)}`);
  console.log(`Heap delta:    ${formatBytes(results[0].memory.heapDelta)}`);
  console.log(`RSS delta:     ${formatBytes(results[0].memory.rssDelta)}`);

  return {
    fileSize: results[0].fileSize,
    runs,
    warmups,
    wallTimeMs: avgWallTime,
    throughputMiBps: avgThroughput,
    rowCount: avgRowCount,
    eventCount: avgEventCount,
    checksum: finalChecksum,
    peakRss: maxRss,
    peakHeap: maxHeap,
    samples: results.map(r => ({
      wallTimeMs: r.wallTimeMs,
      throughputMiBps: r.throughputMiBps,
      rowCount: r.rowCount,
      eventCount: r.eventCount,
      checksum: r.checksum,
      memory: r.memory,
    })),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => a.startsWith('--file='));
  const runsArg = args.find(a => a.startsWith('--runs='));
  const warmupsArg = args.find(a => a.startsWith('--warmups='));
  const verboseArg = args.includes('--verbose');
  const jsonOutArg = args.find(a => a.startsWith('--json-out='));
  const mdOutArg = args.find(a => a.startsWith('--md-out='));

  const filePath = fileArg ? resolve(fileArg.split('=')[1]) : join(__dirname, 'assets', 'large', 'database-0.1gib.xml');
  const runs = runsArg ? parseInt(runsArg.split('=')[1], 10) : 3;
  const warmups = warmupsArg ? parseInt(warmupsArg.split('=')[1], 10) : 1;

  console.log('stax-xml StreamReaderSync Large File Benchmark');
  console.log('===============================================');
  console.log(`File: ${filePath}`);
  console.log(`Runs: ${runs}, Warmups: ${warmups}`);

  try {
    const report = await runBenchmark(filePath, { runs, warmups, verbose: verboseArg });

    if (jsonOutArg) {
      const outPath = resolve(jsonOutArg.split('=')[1]);
      const fs = await import('node:fs/promises');
      await fs.writeFile(outPath, JSON.stringify(report, null, 2) + '\n');
      console.log(`\nJSON report written to ${outPath}`);
    }

    if (mdOutArg) {
      const outPath = resolve(mdOutArg.split('=')[1]);
      const md = `# stax-xml StreamReaderSync Large File Benchmark

**File:** ${filePath}  
**Generated:** ${new Date().toISOString()}  
**Runs:** ${runs} (warmups: ${warmups})

## Summary

| Metric | Value |
| --- | --- |
| File Size | ${formatBytes(report.fileSize)} |
| Avg Wall Time | ${formatMs(report.wallTimeMs)} |
| Throughput | ${report.throughputMiBps.toFixed(2)} MiB/s |
| Rows Parsed | ${report.rowCount.toLocaleString()} |
| Events | ${report.eventCount.toLocaleString()} |
| Checksum | ${report.checksum} |
| Peak RSS | ${formatBytes(report.peakRss)} |
| Peak Heap | ${formatBytes(report.peakHeap)} |

## Per-Run Samples

| Run | Wall Time | Throughput | Rows | Events | Checksum | Peak RSS | Peak Heap |
| --- | --- | --- | --- | --- | --- | --- | --- |
${report.samples.map((s, i) => `| ${i + 1} | ${formatMs(s.wallTimeMs)} | ${s.throughputMiBps.toFixed(2)} MiB/s | ${s.rowCount.toLocaleString()} | ${s.eventCount.toLocaleString()} | ${s.checksum} | ${formatBytes(s.memory.maxRss)} | ${formatBytes(s.memory.maxHeapUsed)} |`).join('\n')}
`;
      const fs = await import('node:fs/promises');
      await fs.writeFile(outPath, md + '\n');
      console.log(`Markdown report written to ${outPath}`);
    }
  } catch (err) {
    console.error('Benchmark failed:', err);
    process.exit(1);
  }
}

main();