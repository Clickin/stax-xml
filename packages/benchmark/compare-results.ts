/**
 * Analyze and visualize benchmark results with comparative analysis
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface BenchmarkMetrics {
  throughputMBps: number;
  eventsPerSecond: number;
  meanLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  memoryUsedMB: number;
  gcTimeMs: number;
}

interface BenchmarkResult {
  variant: string;
  testFile: string;
  fileSize: number;
  metrics: BenchmarkMetrics;
  samples: number[];
}

interface BenchmarkData {
  timestamp: string;
  platform: string;
  nodeVersion: string;
  v8Version: string;
  results: BenchmarkResult[];
}

interface ComparisonStats {
  testFile: string;
  fileSize: number;
  baseline: BenchmarkMetrics;
  inlined: BenchmarkMetrics;
  improvements: {
    throughputPercent: number;
    latencyP50Percent: number;
    latencyP95Percent: number;
    latencyP99Percent: number;
    eventsPerSecondPercent: number;
    memoryPercent: number;
  };
}

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function formatPercent(value: number, invert: boolean = false): string {
  const sign = value > 0 ? '+' : '';
  const color = (invert ? value < 0 : value > 0) ? 'green' : (value === 0 ? 'yellow' : 'red');
  return colorize(`${sign}${value.toFixed(1)}%`, color);
}

// Load benchmark results from JSON file
function loadBenchmarkResults(filePath: string): BenchmarkData {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Benchmark results file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as BenchmarkData;
}

// Compare baseline vs inlined
function compareResults(results: BenchmarkResult[]): ComparisonStats[] {
  const comparisons: ComparisonStats[] = [];
  const groupedByFile = new Map<string, BenchmarkResult[]>();

  // Group results by test file
  for (const result of results) {
    if (!groupedByFile.has(result.testFile)) {
      groupedByFile.set(result.testFile, []);
    }
    groupedByFile.get(result.testFile)!.push(result);
  }

  // Compare each test file
  for (const [testFile, fileResults] of groupedByFile) {
    const baseline = fileResults.find(r => r.variant === 'baseline');
    const inlined = fileResults.find(r => r.variant === 'inlined');

    if (baseline && inlined) {
      comparisons.push({
        testFile,
        fileSize: baseline.fileSize,
        baseline: baseline.metrics,
        inlined: inlined.metrics,
        improvements: {
          throughputPercent: ((inlined.metrics.throughputMBps / baseline.metrics.throughputMBps) - 1) * 100,
          latencyP50Percent: ((baseline.metrics.p50LatencyMs / inlined.metrics.p50LatencyMs) - 1) * 100,
          latencyP95Percent: ((baseline.metrics.p95LatencyMs / inlined.metrics.p95LatencyMs) - 1) * 100,
          latencyP99Percent: ((baseline.metrics.p99LatencyMs / inlined.metrics.p99LatencyMs) - 1) * 100,
          eventsPerSecondPercent: ((inlined.metrics.eventsPerSecond / baseline.metrics.eventsPerSecond) - 1) * 100,
          memoryPercent: ((inlined.metrics.memoryUsedMB / baseline.metrics.memoryUsedMB) - 1) * 100
        }
      });
    }
  }

  return comparisons;
}

// Generate ASCII bar chart
function generateBarChart(value: number, maxValue: number, width: number = 40): string {
  const percentage = Math.min(Math.abs(value) / maxValue, 1);
  const barWidth = Math.floor(percentage * width);
  const bar = '█'.repeat(barWidth) + '░'.repeat(width - barWidth);

  const color = value > 0 ? 'green' : 'red';
  return colorize(bar, color);
}

// Generate detailed comparison report
function generateDetailedReport(comparisons: ComparisonStats[]): string {
  let report = '\n';
  report += colorize('╔════════════════════════════════════════════════════════════════════════╗\n', 'bright');
  report += colorize('║          XML PARSER INLINING PERFORMANCE COMPARISON REPORT           ║\n', 'bright');
  report += colorize('╚════════════════════════════════════════════════════════════════════════╝\n', 'bright');
  report += '\n';

  // Sort by file size
  comparisons.sort((a, b) => a.fileSize - b.fileSize);

  for (const comp of comparisons) {
    const sizeMB = (comp.fileSize / 1024 / 1024).toFixed(2);

    report += colorize(`\n${'═'.repeat(76)}\n`, 'cyan');
    report += colorize(`${comp.testFile.toUpperCase()}`, 'bright') + colorize(` (${sizeMB} MB)\n`, 'dim');
    report += colorize(`${'═'.repeat(76)}\n`, 'cyan');

    // Throughput comparison
    report += '\n' + colorize('📊 THROUGHPUT', 'bright') + '\n';
    report += '─'.repeat(76) + '\n';
    report += `  Baseline:  ${comp.baseline.throughputMBps.toFixed(2).padStart(8)} MB/s\n`;
    report += `  Inlined:   ${comp.inlined.throughputMBps.toFixed(2).padStart(8)} MB/s\n`;
    report += `  Change:    ${formatPercent(comp.improvements.throughputPercent)}\n`;
    report += '  ' + generateBarChart(comp.improvements.throughputPercent, 100) + '\n';

    // Events per second
    report += '\n' + colorize('⚡ EVENTS PER SECOND', 'bright') + '\n';
    report += '─'.repeat(76) + '\n';
    report += `  Baseline:  ${comp.baseline.eventsPerSecond.toFixed(0).padStart(12)} events/s\n`;
    report += `  Inlined:   ${comp.inlined.eventsPerSecond.toFixed(0).padStart(12)} events/s\n`;
    report += `  Change:    ${formatPercent(comp.improvements.eventsPerSecondPercent)}\n`;

    // Latency comparison
    report += '\n' + colorize('⏱️  LATENCY', 'bright') + '\n';
    report += '─'.repeat(76) + '\n';

    report += '  P50 (median):\n';
    report += `    Baseline:  ${comp.baseline.p50LatencyMs.toFixed(2).padStart(8)} ms\n`;
    report += `    Inlined:   ${comp.inlined.p50LatencyMs.toFixed(2).padStart(8)} ms\n`;
    report += `    Change:    ${formatPercent(comp.improvements.latencyP50Percent)}\n`;

    report += '  P95:\n';
    report += `    Baseline:  ${comp.baseline.p95LatencyMs.toFixed(2).padStart(8)} ms\n`;
    report += `    Inlined:   ${comp.inlined.p95LatencyMs.toFixed(2).padStart(8)} ms\n`;
    report += `    Change:    ${formatPercent(comp.improvements.latencyP95Percent)}\n`;

    report += '  P99:\n';
    report += `    Baseline:  ${comp.baseline.p99LatencyMs.toFixed(2).padStart(8)} ms\n`;
    report += `    Inlined:   ${comp.inlined.p99LatencyMs.toFixed(2).padStart(8)} ms\n`;
    report += `    Change:    ${formatPercent(comp.improvements.latencyP99Percent)}\n`;

    // Memory usage
    report += '\n' + colorize('💾 MEMORY USAGE', 'bright') + '\n';
    report += '─'.repeat(76) + '\n';
    report += `  Baseline:  ${comp.baseline.memoryUsedMB.toFixed(2).padStart(8)} MB\n`;
    report += `  Inlined:   ${comp.inlined.memoryUsedMB.toFixed(2).padStart(8)} MB\n`;
    report += `  Change:    ${formatPercent(comp.improvements.memoryPercent, true)}\n`;

    // GC time
    if (comp.baseline.gcTimeMs > 0 || comp.inlined.gcTimeMs > 0) {
      report += '\n' + colorize('🗑️  GARBAGE COLLECTION', 'bright') + '\n';
      report += '─'.repeat(76) + '\n';
      report += `  Baseline:  ${comp.baseline.gcTimeMs.toFixed(2).padStart(8)} ms\n`;
      report += `  Inlined:   ${comp.inlined.gcTimeMs.toFixed(2).padStart(8)} ms\n`;
    }
  }

  // Overall summary
  report += '\n\n';
  report += colorize('╔════════════════════════════════════════════════════════════════════════╗\n', 'bright');
  report += colorize('║                          OVERALL SUMMARY                               ║\n', 'bright');
  report += colorize('╚════════════════════════════════════════════════════════════════════════╝\n', 'bright');
  report += '\n';

  const avgThroughputImprovement = comparisons.reduce((sum, c) => sum + c.improvements.throughputPercent, 0) / comparisons.length;
  const avgLatencyImprovement = comparisons.reduce((sum, c) => sum + c.improvements.latencyP50Percent, 0) / comparisons.length;
  const avgMemoryChange = comparisons.reduce((sum, c) => sum + c.improvements.memoryPercent, 0) / comparisons.length;

  report += `Average Throughput Improvement: ${formatPercent(avgThroughputImprovement)}\n`;
  report += `Average Latency Improvement:    ${formatPercent(avgLatencyImprovement)}\n`;
  report += `Average Memory Change:          ${formatPercent(avgMemoryChange, true)}\n`;

  report += '\n';

  // Find best and worst improvements
  const bestThroughput = comparisons.reduce((best, c) => c.improvements.throughputPercent > best.improvements.throughputPercent ? c : best);
  const worstThroughput = comparisons.reduce((worst, c) => c.improvements.throughputPercent < worst.improvements.throughputPercent ? c : worst);

  report += colorize('Best throughput improvement: ', 'bright') + `${bestThroughput.testFile} (${formatPercent(bestThroughput.improvements.throughputPercent)})\n`;
  report += colorize('Worst throughput improvement: ', 'bright') + `${worstThroughput.testFile} (${formatPercent(worstThroughput.improvements.throughputPercent)})\n`;

  return report;
}

// Generate CSV export for spreadsheet analysis
function generateCSV(comparisons: ComparisonStats[]): string {
  let csv = 'Test File,File Size (MB),';
  csv += 'Baseline Throughput (MB/s),Inlined Throughput (MB/s),Throughput Improvement (%),';
  csv += 'Baseline P50 Latency (ms),Inlined P50 Latency (ms),P50 Latency Improvement (%),';
  csv += 'Baseline P95 Latency (ms),Inlined P95 Latency (ms),P95 Latency Improvement (%),';
  csv += 'Baseline Memory (MB),Inlined Memory (MB),Memory Change (%)\n';

  for (const comp of comparisons) {
    const sizeMB = (comp.fileSize / 1024 / 1024).toFixed(2);
    csv += `${comp.testFile},${sizeMB},`;
    csv += `${comp.baseline.throughputMBps.toFixed(2)},${comp.inlined.throughputMBps.toFixed(2)},${comp.improvements.throughputPercent.toFixed(2)},`;
    csv += `${comp.baseline.p50LatencyMs.toFixed(2)},${comp.inlined.p50LatencyMs.toFixed(2)},${comp.improvements.latencyP50Percent.toFixed(2)},`;
    csv += `${comp.baseline.p95LatencyMs.toFixed(2)},${comp.inlined.p95LatencyMs.toFixed(2)},${comp.improvements.latencyP95Percent.toFixed(2)},`;
    csv += `${comp.baseline.memoryUsedMB.toFixed(2)},${comp.inlined.memoryUsedMB.toFixed(2)},${comp.improvements.memoryPercent.toFixed(2)}\n`;
  }

  return csv;
}

// Generate markdown table for README/documentation
function generateMarkdownTable(comparisons: ComparisonStats[]): string {
  let md = '# XML Parser Inlining Performance Results\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;

  md += '## Performance Comparison\n\n';
  md += '| Test File | Size | Throughput | Latency (P50) | Latency (P95) | Memory |\n';
  md += '|-----------|------|------------|---------------|---------------|--------|\n';

  for (const comp of comparisons) {
    const sizeMB = (comp.fileSize / 1024 / 1024).toFixed(1);
    const throughputChange = comp.improvements.throughputPercent >= 0 ? '↑' : '↓';
    const latencyChange = comp.improvements.latencyP50Percent >= 0 ? '↑' : '↓';
    const memoryChange = comp.improvements.memoryPercent >= 0 ? '↑' : '↓';

    md += `| ${comp.testFile} | ${sizeMB} MB | `;
    md += `${throughputChange} ${Math.abs(comp.improvements.throughputPercent).toFixed(1)}% | `;
    md += `${latencyChange} ${Math.abs(comp.improvements.latencyP50Percent).toFixed(1)}% | `;
    md += `${latencyChange} ${Math.abs(comp.improvements.latencyP95Percent).toFixed(1)}% | `;
    md += `${memoryChange} ${Math.abs(comp.improvements.memoryPercent).toFixed(1)}% |\n`;
  }

  md += '\n## Summary Statistics\n\n';

  const avgThroughput = comparisons.reduce((sum, c) => sum + c.improvements.throughputPercent, 0) / comparisons.length;
  const avgLatency = comparisons.reduce((sum, c) => sum + c.improvements.latencyP50Percent, 0) / comparisons.length;

  md += `- **Average Throughput Improvement**: ${avgThroughput >= 0 ? '+' : ''}${avgThroughput.toFixed(1)}%\n`;
  md += `- **Average Latency Improvement**: ${avgLatency >= 0 ? '+' : ''}${avgLatency.toFixed(1)}%\n`;

  return md;
}

// Generate HTML report
function generateHTMLReport(comparisons: ComparisonStats[], benchmarkData: BenchmarkData): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XML Parser Performance Comparison</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .metadata {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .test-result {
            background: white;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 5px;
        }
        .improvement {
            font-weight: bold;
        }
        .positive { color: #28a745; }
        .negative { color: #dc3545; }
        .bar {
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 5px 0;
        }
        .bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
            transition: width 0.3s ease;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 XML Parser Performance Comparison</h1>
        <p>Inlined vs Baseline Performance Analysis</p>
    </div>

    <div class="metadata">
        <h2>Test Environment</h2>
        <table>
            <tr><th>Property</th><th>Value</th></tr>
            <tr><td>Node.js Version</td><td>${benchmarkData.nodeVersion}</td></tr>
            <tr><td>V8 Version</td><td>${benchmarkData.v8Version}</td></tr>
            <tr><td>Platform</td><td>${benchmarkData.platform}</td></tr>
            <tr><td>Timestamp</td><td>${benchmarkData.timestamp}</td></tr>
        </table>
    </div>
`;

  for (const comp of comparisons) {
    const sizeMB = (comp.fileSize / 1024 / 1024).toFixed(2);

    html += `
    <div class="test-result">
        <h2>${comp.testFile}</h2>
        <p>File Size: ${sizeMB} MB</p>

        <h3>Throughput</h3>
        <div class="metric">
            <span>Baseline:</span>
            <span>${comp.baseline.throughputMBps.toFixed(2)} MB/s</span>
        </div>
        <div class="metric">
            <span>Inlined:</span>
            <span>${comp.inlined.throughputMBps.toFixed(2)} MB/s</span>
        </div>
        <div class="metric">
            <span>Improvement:</span>
            <span class="improvement ${comp.improvements.throughputPercent > 0 ? 'positive' : 'negative'}">
                ${comp.improvements.throughputPercent > 0 ? '+' : ''}${comp.improvements.throughputPercent.toFixed(1)}%
            </span>
        </div>
        <div class="bar">
            <div class="bar-fill" style="width: ${Math.min(Math.abs(comp.improvements.throughputPercent), 100)}%"></div>
        </div>

        <h3>Latency</h3>
        <table>
            <tr>
                <th>Percentile</th>
                <th>Baseline</th>
                <th>Inlined</th>
                <th>Improvement</th>
            </tr>
            <tr>
                <td>P50</td>
                <td>${comp.baseline.p50LatencyMs.toFixed(2)} ms</td>
                <td>${comp.inlined.p50LatencyMs.toFixed(2)} ms</td>
                <td class="${comp.improvements.latencyP50Percent > 0 ? 'positive' : 'negative'}">
                    ${comp.improvements.latencyP50Percent > 0 ? '+' : ''}${comp.improvements.latencyP50Percent.toFixed(1)}%
                </td>
            </tr>
            <tr>
                <td>P95</td>
                <td>${comp.baseline.p95LatencyMs.toFixed(2)} ms</td>
                <td>${comp.inlined.p95LatencyMs.toFixed(2)} ms</td>
                <td class="${comp.improvements.latencyP95Percent > 0 ? 'positive' : 'negative'}">
                    ${comp.improvements.latencyP95Percent > 0 ? '+' : ''}${comp.improvements.latencyP95Percent.toFixed(1)}%
                </td>
            </tr>
            <tr>
                <td>P99</td>
                <td>${comp.baseline.p99LatencyMs.toFixed(2)} ms</td>
                <td>${comp.inlined.p99LatencyMs.toFixed(2)} ms</td>
                <td class="${comp.improvements.latencyP99Percent > 0 ? 'positive' : 'negative'}">
                    ${comp.improvements.latencyP99Percent > 0 ? '+' : ''}${comp.improvements.latencyP99Percent.toFixed(1)}%
                </td>
            </tr>
        </table>
    </div>
`;
  }

  html += `
</body>
</html>`;

  return html;
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: tsx compare-results.ts <results-file.json> [--format=console|csv|markdown|html]');
    console.log('\nExample:');
    console.log('  tsx compare-results.ts results/inlining-benchmark-2024-01-15.json');
    console.log('  tsx compare-results.ts results/inlining-benchmark-2024-01-15.json --format=html');
    process.exit(1);
  }

  const resultsFile = args[0];
  const format = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'console';

  console.log(`Loading benchmark results from: ${resultsFile}`);

  const benchmarkData = loadBenchmarkResults(resultsFile);
  const comparisons = compareResults(benchmarkData.results);

  if (comparisons.length === 0) {
    console.error('No valid comparisons found. Ensure both baseline and inlined results exist.');
    process.exit(1);
  }

  const outputDir = path.join(__dirname, 'results');
  const baseFileName = path.basename(resultsFile, '.json');

  switch (format) {
    case 'console':
      const report = generateDetailedReport(comparisons);
      console.log(report);
      break;

    case 'csv':
      const csv = generateCSV(comparisons);
      const csvPath = path.join(outputDir, `${baseFileName}-comparison.csv`);
      fs.writeFileSync(csvPath, csv, 'utf8');
      console.log(`CSV report saved to: ${csvPath}`);
      break;

    case 'markdown':
      const markdown = generateMarkdownTable(comparisons);
      const mdPath = path.join(outputDir, `${baseFileName}-comparison.md`);
      fs.writeFileSync(mdPath, markdown, 'utf8');
      console.log(`Markdown report saved to: ${mdPath}`);
      break;

    case 'html':
      const html = generateHTMLReport(comparisons, benchmarkData);
      const htmlPath = path.join(outputDir, `${baseFileName}-comparison.html`);
      fs.writeFileSync(htmlPath, html, 'utf8');
      console.log(`HTML report saved to: ${htmlPath}`);
      console.log(`Open in browser: file://${htmlPath}`);
      break;

    default:
      console.error(`Unknown format: ${format}`);
      process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch(console.error);
}

export { compareResults, generateDetailedReport, generateCSV, generateMarkdownTable, generateHTMLReport };