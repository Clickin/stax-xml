/**
 * Generate markdown reports from benchmark results
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function generateMarkdownReport(results) {
    const lines = [];
    // Header
    lines.push('# Benchmark Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date(results.timestamp).toLocaleString()}`);
    lines.push(`**Iterations:** ${results.iterations}`);
    lines.push(`**Warmup:** ${results.warmup}`);
    lines.push('');
    // Group results by pattern
    const byPattern = new Map();
    for (const result of results.results) {
        if (!byPattern.has(result.pattern)) {
            byPattern.set(result.pattern, []);
        }
        byPattern.get(result.pattern).push(result);
    }
    // Generate tables for each pattern
    for (const [pattern, patternResults] of byPattern.entries()) {
        lines.push(`## Pattern: ${pattern}`);
        lines.push('');
        // Performance table
        lines.push('### Performance');
        lines.push('');
        lines.push('| Variant | Time (ms) | Throughput (ops/s) | Speedup | Significant |');
        lines.push('|---------|-----------|-------------------|---------|-------------|');
        for (const result of patternResults) {
            const time = result.avgTime.toFixed(3);
            const throughput = result.throughput.toFixed(1);
            const speedup = result.comparison ? `${result.comparison.speedup.toFixed(2)}x` : '-';
            const significant = result.statisticalTest?.significant
                ? result.statisticalTest.improvement > 0
                    ? '✓ Yes'
                    : '✗ Regressed'
                : '~ No';
            lines.push(`| ${result.variant} | ${time} | ${throughput} | ${speedup} | ${significant} |`);
        }
        lines.push('');
        // Memory & GC table
        lines.push('### Memory & GC Pressure');
        lines.push('');
        lines.push('| Variant | Heap Delta (MB) | Major GCs | Minor GCs | Total GC Time (ms) |');
        lines.push('|---------|----------------|-----------|-----------|-------------------|');
        for (const result of patternResults) {
            const heap = result.gcMetrics.heapUsedDelta.toFixed(2);
            const major = result.gcMetrics.majorGCCount;
            const minor = result.gcMetrics.minorGCCount;
            const gcTime = result.gcMetrics.totalGCTime.toFixed(1);
            lines.push(`| ${result.variant} | ${heap} | ${major} | ${minor} | ${gcTime} |`);
        }
        lines.push('');
        // Comparison details
        const baseline = patternResults.find(r => r.variant === 'baseline');
        if (baseline) {
            const optimized = patternResults.filter(r => r.variant !== 'baseline');
            if (optimized.length > 0) {
                lines.push('### Comparisons to Baseline');
                lines.push('');
                for (const opt of optimized) {
                    if (!opt.comparison || !opt.statisticalTest)
                        continue;
                    lines.push(`#### ${opt.variant}`);
                    lines.push('');
                    lines.push(`- **Performance:** ${opt.statisticalTest.improvement.toFixed(1)}% ${opt.statisticalTest.improvement > 0 ? 'faster' : 'slower'}`);
                    lines.push(`- **Memory:** ${opt.comparison.memoryImprovement.toFixed(1)}% ${opt.comparison.memoryImprovement > 0 ? 'less' : 'more'} heap usage`);
                    lines.push(`- **GC Pressure:** ${opt.comparison.gcReduction.toFixed(1)}% ${opt.comparison.gcReduction > 0 ? 'fewer' : 'more'} GC events`);
                    lines.push(`- **Statistical Significance:** p=${opt.statisticalTest.pValue.toFixed(6)} ${opt.statisticalTest.significant ? '(significant)' : '(not significant)'}`);
                    // Verdict
                    if (opt.statisticalTest.significant && opt.statisticalTest.improvement > 5 && opt.comparison.memoryImprovement > -10) {
                        lines.push(`- **Verdict:** ✓ **ACCEPT** - Clear improvement with acceptable memory trade-off`);
                    }
                    else if (opt.statisticalTest.significant && opt.statisticalTest.improvement < -5) {
                        lines.push(`- **Verdict:** ✗ **REJECT** - Statistically significant regression`);
                    }
                    else if (opt.comparison.memoryImprovement < -50) {
                        lines.push(`- **Verdict:** ✗ **REJECT** - Excessive memory regression`);
                    }
                    else {
                        lines.push(`- **Verdict:** ~ **NEUTRAL** - No significant improvement`);
                    }
                    lines.push('');
                }
            }
        }
        lines.push('---');
        lines.push('');
    }
    // Summary recommendations
    lines.push('## Summary & Recommendations');
    lines.push('');
    const accepted = [];
    const rejected = [];
    const neutral = [];
    for (const result of results.results) {
        if (result.variant === 'baseline' || !result.statisticalTest || !result.comparison)
            continue;
        const name = `${result.variant} (${result.pattern})`;
        if (result.statisticalTest.significant && result.statisticalTest.improvement > 5 && result.comparison.memoryImprovement > -10) {
            accepted.push(name);
        }
        else if (result.statisticalTest.significant && result.statisticalTest.improvement < -5) {
            rejected.push(name);
        }
        else if (result.comparison.memoryImprovement < -50) {
            rejected.push(name);
        }
        else {
            neutral.push(name);
        }
    }
    if (accepted.length > 0) {
        lines.push('### ✓ Accepted Optimizations');
        lines.push('');
        accepted.forEach(name => lines.push(`- ${name}`));
        lines.push('');
    }
    if (rejected.length > 0) {
        lines.push('### ✗ Rejected Optimizations');
        lines.push('');
        rejected.forEach(name => lines.push(`- ${name}`));
        lines.push('');
    }
    if (neutral.length > 0) {
        lines.push('### ~ Neutral Results');
        lines.push('');
        neutral.forEach(name => lines.push(`- ${name}`));
        lines.push('');
    }
    return lines.join('\n');
}
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node generate-report.mjs <results-file.json> [output-file.md]');
        console.error('');
        console.error('Example:');
        console.error('  node generate-report.mjs results/benchmark-2024-01-15.json report.md');
        process.exit(1);
    }
    const inputFile = args[0];
    const outputFile = args[1] || inputFile.replace('.json', '.md');
    if (!fs.existsSync(inputFile)) {
        console.error(`Error: File not found: ${inputFile}`);
        process.exit(1);
    }
    console.log(`Reading results from: ${inputFile}`);
    const content = fs.readFileSync(inputFile, 'utf8');
    const results = JSON.parse(content);
    console.log(`Generating markdown report...`);
    const markdown = generateMarkdownReport(results);
    fs.writeFileSync(outputFile, markdown, 'utf8');
    console.log(`Report saved to: ${outputFile}`);
    console.log('');
    console.log('Preview:');
    console.log('---');
    console.log(markdown.split('\n').slice(0, 30).join('\n'));
    console.log('...');
}
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    main().catch(console.error);
}
export { generateMarkdownReport };
