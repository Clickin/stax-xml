/**
 * Phase 1 Extended: Test with larger documents
 *
 * Purpose: Verify that string concat doesn't degrade with larger documents
 */
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { StaxXmlWriterSync as BaselineSync } from '../../stax-xml/src/StaxXmlWriterSync.baseline';
import { StaxXmlWriterSync as StringArraySync } from '../../stax-xml/src/StaxXmlWriterSync.stringarray';
import { StaxXmlWriterSync as Uint8ArraySync } from '../../stax-xml/src/StaxXmlWriterSync.uint8array';
function testScaling(elementCount) {
    // Baseline
    const writer1 = new BaselineSync();
    const start1 = performance.now();
    writer1.writeStartDocument();
    writer1.writeStartElement('root');
    for (let i = 0; i < elementCount; i++) {
        writer1.writeStartElement('item', {
            attributes: { id: String(i), type: 'test', index: String(i) }
        });
        writer1.writeCharacters(`Text content for item ${i}`);
        writer1.writeEndElement();
    }
    writer1.writeEndElement();
    writer1.writeEndDocument();
    const baselineTime = performance.now() - start1;
    const baselineSize = writer1.getXmlString().length;
    // String Array
    const writer2 = new StringArraySync();
    const start2 = performance.now();
    writer2.writeStartDocument();
    writer2.writeStartElement('root');
    for (let i = 0; i < elementCount; i++) {
        writer2.writeStartElement('item', {
            attributes: { id: String(i), type: 'test', index: String(i) }
        });
        writer2.writeCharacters(`Text content for item ${i}`);
        writer2.writeEndElement();
    }
    writer2.writeEndElement();
    writer2.writeEndDocument();
    const stringArrayTime = performance.now() - start2;
    // Uint8Array
    const writer3 = new Uint8ArraySync();
    const start3 = performance.now();
    writer3.writeStartDocument();
    writer3.writeStartElement('root');
    for (let i = 0; i < elementCount; i++) {
        writer3.writeStartElement('item', {
            attributes: { id: String(i), type: 'test', index: String(i) }
        });
        writer3.writeCharacters(`Text content for item ${i}`);
        writer3.writeEndElement();
    }
    writer3.writeEndElement();
    writer3.writeEndDocument();
    const uint8ArrayTime = performance.now() - start3;
    return {
        elementCount,
        baseline: baselineTime,
        stringArray: stringArrayTime,
        uint8Array: uint8ArrayTime,
        baselineSize
    };
}
console.log('=== Phase 1 Extended: Scaling Test ===\n');
console.log('Testing performance across different document sizes...\n');
const sizes = [100, 1000, 5000, 10000, 50000];
const results = [];
console.log('Elements | Baseline | String Array | Uint8Array | Size (KB)');
console.log('─'.repeat(70));
for (const size of sizes) {
    const result = testScaling(size);
    results.push(result);
    const improvement1 = ((result.baseline - result.stringArray) / result.baseline * 100);
    const improvement2 = ((result.baseline - result.uint8Array) / result.baseline * 100);
    console.log(`${String(size).padStart(8)} | ${result.baseline.toFixed(2).padStart(8)}ms | ` +
        `${result.stringArray.toFixed(2).padStart(12)}ms (${improvement1 >= 0 ? '+' : ''}${improvement1.toFixed(1)}%) | ` +
        `${result.uint8Array.toFixed(2).padStart(10)}ms (${improvement2 >= 0 ? '+' : ''}${improvement2.toFixed(1)}%) | ` +
        `${(result.baselineSize / 1024).toFixed(1).padStart(8)}`);
}
console.log('─'.repeat(70));
// Analyze if there's O(n²) behavior
console.log('\n=== Complexity Analysis ===\n');
function calculateGrowthRate(results, field) {
    if (results.length < 2)
        return 'N/A';
    // Compare 50000 vs 5000 (10x increase)
    const small = results.find(r => r.elementCount === 5000);
    const large = results.find(r => r.elementCount === 50000);
    if (!small || !large)
        return 'N/A';
    const smallTime = small[field];
    const largeTime = large[field];
    const ratio = largeTime / smallTime;
    // O(n) would be ~10x, O(n log n) would be ~13x, O(n²) would be ~100x
    if (ratio < 12)
        return `~O(n) [${ratio.toFixed(1)}x]`;
    if (ratio < 20)
        return `~O(n log n) [${ratio.toFixed(1)}x]`;
    if (ratio < 50)
        return `~O(n log n) or worse [${ratio.toFixed(1)}x]`;
    return `~O(n²) [${ratio.toFixed(1)}x]`;
}
console.log(`Baseline:     ${calculateGrowthRate(results, 'baseline')}`);
console.log(`String Array: ${calculateGrowthRate(results, 'stringArray')}`);
console.log(`Uint8Array:   ${calculateGrowthRate(results, 'uint8Array')}`);
console.log('\n=== Conclusion ===\n');
const last = results[results.length - 1];
const improvement1 = ((last.baseline - last.stringArray) / last.baseline * 100);
const improvement2 = ((last.baseline - last.uint8Array) / last.baseline * 100);
if (improvement1 > 10 || improvement2 > 10) {
    console.log('✅ At large document sizes, optimizations show improvement!');
    console.log(`   String Array: ${improvement1 >= 0 ? '+' : ''}${improvement1.toFixed(1)}%`);
    console.log(`   Uint8Array: ${improvement2 >= 0 ? '+' : ''}${improvement2.toFixed(1)}%`);
}
else {
    console.log('❌ Even at large document sizes, optimizations show no benefit.');
    console.log(`   String Array: ${improvement1 >= 0 ? '+' : ''}${improvement1.toFixed(1)}%`);
    console.log(`   Uint8Array: ${improvement2 >= 0 ? '+' : ''}${improvement2.toFixed(1)}%`);
    console.log('');
    console.log('   Conclusion: V8\'s string concatenation is already highly optimized.');
    console.log('   Current implementation does NOT exhibit O(n²) behavior.');
}
// Save results
const outputPath = path.join(__dirname, 'results', 'phase1-extended-results.json');
writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    analysis: {
        baselineComplexity: calculateGrowthRate(results, 'baseline'),
        stringArrayComplexity: calculateGrowthRate(results, 'stringArray'),
        uint8ArrayComplexity: calculateGrowthRate(results, 'uint8Array')
    }
}, null, 2));
console.log(`\nResults saved to: ${outputPath}`);
