/**
 * Validate that the benchmarking infrastructure is set up correctly
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const checks = [
    // Check 1: Required directories exist
    () => {
        const dirs = ['test-data', 'results', 'profiles'];
        const missing = dirs.filter(dir => !fs.existsSync(path.join(__dirname, dir)));
        if (missing.length > 0) {
            return {
                passed: false,
                message: 'Required directories missing',
                details: `Missing: ${missing.join(', ')}`
            };
        }
        return {
            passed: true,
            message: 'All required directories exist'
        };
    },
    // Check 2: Core scripts exist
    () => {
        const scripts = [
            'generate-test-xmls.mjs',
            'benchmark-inlining.mjs',
            'profile-parsers.mjs',
            'compare-results.mjs',
            'benchmark.config.mjs'
        ];
        const missing = scripts.filter(script => !fs.existsSync(path.join(__dirname, script)));
        if (missing.length > 0) {
            return {
                passed: false,
                message: 'Required scripts missing',
                details: `Missing: ${missing.join(', ')}`
            };
        }
        return {
            passed: true,
            message: 'All core scripts present'
        };
    },
    // Check 3: Test data availability
    () => {
        const testDataDir = path.join(__dirname, 'test-data');
        const xmlFiles = fs.existsSync(testDataDir)
            ? fs.readdirSync(testDataDir).filter(f => f.endsWith('.xml'))
            : [];
        if (xmlFiles.length === 0) {
            return {
                passed: false,
                message: 'No test data found',
                details: 'Run: pnpm run generate:testdata'
            };
        }
        return {
            passed: true,
            message: `Test data ready (${xmlFiles.length} files)`
        };
    },
    // Check 4: Parser source availability
    () => {
        const parserPath = path.resolve(__dirname, '../../stax-xml/src/EventReaderSync.ts');
        const baselinePath = path.resolve(__dirname, '../../stax-xml/src/EventReaderSync.baseline.ts');
        if (!fs.existsSync(parserPath)) {
            return {
                passed: false,
                message: 'Main parser not found',
                details: `Expected at: ${parserPath}`
            };
        }
        const hasBaseline = fs.existsSync(baselinePath);
        return {
            passed: true,
            message: hasBaseline
                ? 'Both baseline and inlined parsers available'
                : 'Main parser available (baseline will use same as inlined)'
        };
    },
    // Check 5: Node.js version
    () => {
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0]);
        if (major < 20) {
            return {
                passed: false,
                message: 'Node.js version too old',
                details: `Current: ${version}, Required: >= 20.19.0`
            };
        }
        return {
            passed: true,
            message: `Node.js version OK (${version})`
        };
    },
    // Check 6: --expose-gc availability
    () => {
        if (!global.gc) {
            return {
                passed: false,
                message: 'GC control not available',
                details: 'Run with: node --expose-gc'
            };
        }
        return {
            passed: true,
            message: 'GC control available'
        };
    },
    // Check 7: Dependencies
    () => {
        const packageJsonPath = path.join(__dirname, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const requiredDeps = ['mitata', 'stax-xml'];
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        const missing = requiredDeps.filter(dep => !deps[dep]);
        if (missing.length > 0) {
            return {
                passed: false,
                message: 'Required dependencies missing',
                details: `Missing: ${missing.join(', ')}. Run: pnpm install`
            };
        }
        return {
            passed: true,
            message: 'All required dependencies installed'
        };
    }
];
async function validateSetup() {
    console.log('🔍 Validating Benchmark Infrastructure Setup\n');
    console.log('═'.repeat(60));
    let passedCount = 0;
    let failedCount = 0;
    for (const check of checks) {
        const result = check();
        const icon = result.passed ? '✅' : '❌';
        console.log(`\n${icon} ${result.message}`);
        if (result.details) {
            console.log(`   ${result.details}`);
        }
        if (result.passed) {
            passedCount++;
        }
        else {
            failedCount++;
        }
    }
    console.log('\n' + '═'.repeat(60));
    console.log(`\nResults: ${passedCount} passed, ${failedCount} failed`);
    if (failedCount > 0) {
        console.log('\n⚠️  Some checks failed. Please address the issues above.');
        console.log('\nQuick fixes:');
        console.log('  - Generate test data: pnpm run generate:testdata');
        console.log('  - Install dependencies: pnpm install');
        console.log('  - Run with GC: node --expose-gc <script>.mjs');
        console.log('  - Check Node.js version: node --version (need >= 20.19.0)');
        process.exit(1);
    }
    console.log('\n✨ All checks passed! Ready to run benchmarks.');
    console.log('\nNext steps:');
    console.log('  1. Generate test data: pnpm run generate:testdata');
    console.log('  2. Run baseline: pnpm run bench:baseline');
    console.log('  3. Run canonical benchmarks: pnpm run bench:all');
    console.log('  4. Generate HTML report: node generate-report.mjs <results-file>');
    console.log('\nOr run the complete workflow: pnpm run workflow:full');
}
// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    validateSetup().catch(console.error);
}
export { validateSetup };
