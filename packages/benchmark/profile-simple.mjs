/**
 * Simple profiling script for baseline vs inlined parsers
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import inspector from 'node:inspector';
// Import both parser variants
import { StaxXmlParserSync as BaselineParser } from './parsers/baseline';
import { StaxXmlParserSync as InlinedParser } from './parsers/inlined';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function parseXML(ParserClass, xml) {
    const start = performance.now();
    const parser = new ParserClass(xml);
    let eventCount = 0;
    for (const event of parser) {
        eventCount++;
    }
    const end = performance.now();
    return { eventCount, time: end - start };
}
async function profileParser(name, ParserClass, xml, testFile) {
    console.log(`\nProfiling ${name} with ${testFile}...`);
    // Warmup
    for (let i = 0; i < 3; i++) {
        parseXML(ParserClass, xml);
    }
    if (global.gc)
        global.gc();
    const memBefore = process.memoryUsage().heapUsed;
    // Profile multiple runs
    let totalTime = 0;
    let totalEvents = 0;
    const runs = 100;
    for (let i = 0; i < runs; i++) {
        const { eventCount, time } = parseXML(ParserClass, xml);
        totalTime += time;
        totalEvents = eventCount;
    }
    const memAfter = process.memoryUsage().heapUsed;
    const memoryUsed = (memAfter - memBefore) / 1024 / 1024;
    return {
        variant: name,
        testFile,
        totalTime,
        eventCount: totalEvents,
        memoryUsed
    };
}
async function profileWithInspector(name, ParserClass, xml, outputFile) {
    console.log(`\nGenerating CPU profile for ${name}...`);
    const session = new inspector.Session();
    session.connect();
    // Start profiling
    await new Promise((resolve) => {
        session.post('Profiler.enable', () => {
            session.post('Profiler.start', resolve);
        });
    });
    // Run parsing many times
    const runs = 1000;
    for (let i = 0; i < runs; i++) {
        parseXML(ParserClass, xml);
    }
    // Stop profiling and save
    const profile = await new Promise((resolve) => {
        session.post('Profiler.stop', (err, { profile }) => {
            resolve(profile);
        });
    });
    session.disconnect();
    // Save profile
    fs.writeFileSync(outputFile, JSON.stringify(profile, null, 2));
    console.log(`  Saved CPU profile to: ${outputFile}`);
    console.log(`  Open in Chrome DevTools: chrome://inspect -> Load profile`);
}
async function main() {
    const variant = process.argv[2] || 'both';
    const testFileName = process.argv[3] || 'medium-nested.xml';
    console.log('=== XML Parser Profiling ===');
    console.log(`Node.js: ${process.version}`);
    console.log(`Variant: ${variant}`);
    console.log(`Test file: ${testFileName}`);
    const testDataDir = path.join(__dirname, 'test-data');
    const profilesDir = path.join(__dirname, 'profiles');
    const testFile = path.join(testDataDir, testFileName);
    if (!fs.existsSync(testFile)) {
        console.error(`Test file not found: ${testFile}`);
        process.exit(1);
    }
    const xml = fs.readFileSync(testFile, 'utf8');
    const fileSize = fs.statSync(testFile).size;
    console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB\n`);
    const results = [];
    // Profile baseline
    if (variant === 'baseline' || variant === 'both') {
        const result = await profileParser('baseline', BaselineParser, xml, testFileName);
        results.push(result);
        console.log(`  Total time: ${result.totalTime.toFixed(2)} ms`);
        console.log(`  Events: ${result.eventCount}`);
        console.log(`  Memory: ${result.memoryUsed.toFixed(2)} MB`);
        // Generate CPU profile
        const profileFile = path.join(profilesDir, `baseline-${Date.now()}.cpuprofile`);
        await profileWithInspector('baseline', BaselineParser, xml, profileFile);
    }
    // Profile inlined
    if (variant === 'inlined' || variant === 'both') {
        const result = await profileParser('inlined', InlinedParser, xml, testFileName);
        results.push(result);
        console.log(`  Total time: ${result.totalTime.toFixed(2)} ms`);
        console.log(`  Events: ${result.eventCount}`);
        console.log(`  Memory: ${result.memoryUsed.toFixed(2)} MB`);
        // Generate CPU profile
        const profileFile = path.join(profilesDir, `inlined-${Date.now()}.cpuprofile`);
        await profileWithInspector('inlined', InlinedParser, xml, profileFile);
    }
    // Comparison
    if (results.length === 2) {
        console.log('\n=== Comparison ===');
        const timeRatio = (results[1].totalTime / results[0].totalTime - 1) * 100;
        const memRatio = (results[1].memoryUsed / results[0].memoryUsed - 1) * 100;
        console.log(`Time difference: ${timeRatio > 0 ? '+' : ''}${timeRatio.toFixed(2)}%`);
        console.log(`Memory difference: ${memRatio > 0 ? '+' : ''}${memRatio.toFixed(2)}%`);
    }
    console.log('\n=== Next Steps ===');
    console.log('1. Open Chrome browser');
    console.log('2. Go to: chrome://inspect');
    console.log('3. Click "Open dedicated DevTools for Node"');
    console.log('4. Go to "Profiler" tab');
    console.log('5. Click "Load" and select the .cpuprofile file');
    console.log('6. View the flame graph');
}
main().catch(console.error);
