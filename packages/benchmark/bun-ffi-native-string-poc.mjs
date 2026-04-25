import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { dlopen, ptr } from 'bun:ffi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPORT_DIR = join(__dirname, 'knowledge', 'reports', 'iterable');
const TIER_IDS = ['count-only', 'full-string-direct', 'event-object-full'];
const RESULT_BYTES = 24;

function parseArgs(argv) {
  const options = {
    file: join(__dirname, 'test-data', 'rust-native-aggregate-v2-mixed-utf8-1mib.xml'),
    tier: 'full-string-direct',
    runs: 5,
    warmups: 1,
    jsonOut: undefined,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        break;
      case '--tier':
        options.tier = parseTier(readValue());
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function parseTier(value) {
  if (!TIER_IDS.includes(value)) throw new Error(`Unknown tier ${value}. Expected: ${TIER_IDS.join(', ')}`);
  return value;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer.`);
  return parsed;
}

function nativeLibraryPath() {
  const targetDir = join(__dirname, '..', 'native-aggregate', 'target', 'release');
  if (process.platform === 'win32') return join(targetDir, 'stax_xml_native_aggregate.dll');
  if (process.platform === 'darwin') return join(targetDir, 'libstax_xml_native_aggregate.dylib');
  return join(targetDir, 'libstax_xml_native_aggregate.so');
}

function tierId(tier) {
  return TIER_IDS.indexOf(tier);
}

function stringToUtf16Units(input) {
  const units = new Uint16Array(input.length);
  for (let index = 0; index < input.length; index++) {
    units[index] = input.charCodeAt(index);
  }
  return units;
}

function readResult(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    eventCount: view.getUint32(0, true),
    checksum: view.getInt32(4, true),
    attrCountTotal: view.getUint32(8, true),
    objectCount: view.getUint32(12, true),
    inputUnits: Number(view.getBigUint64(16, true)),
  };
}

function createFfiRunner(libraryPath) {
  const lib = dlopen(libraryPath, {
    stax_xml_parse_aggregate_utf16_units: {
      args: ['ptr', 'usize', 'u32', 'ptr'],
      returns: 'i32',
    },
  });
  return {
    close: lib.close,
    parse(units, tier) {
      const out = new Uint8Array(RESULT_BYTES);
      const status = lib.symbols.stax_xml_parse_aggregate_utf16_units(
        ptr(units),
        units.length,
        tierId(tier),
        ptr(out),
      );
      if (status !== 0) throw new Error(`FFI parser returned status ${status}`);
      return readResult(out);
    },
  };
}

function measure(label, run, fileSizeMiB, options) {
  for (let index = 0; index < options.warmups; index++) run();
  const samplesMs = [];
  let eventCount = 0;
  let checksum = 0;
  let attrCountTotal = 0;
  let objectCount = 0;
  let inputUnits = 0;
  for (let index = 0; index < options.runs; index++) {
    const startedAt = performance.now();
    const result = run();
    const elapsedMs = performance.now() - startedAt;
    if (index > 0 && (result.eventCount !== eventCount || result.checksum !== checksum)) {
      throw new Error(`${label} produced unstable event count/checksum`);
    }
    eventCount = result.eventCount;
    checksum = result.checksum;
    attrCountTotal = result.attrCountTotal;
    objectCount = result.objectCount;
    inputUnits = result.inputUnits;
    samplesMs.push(elapsedMs);
  }
  const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
  return {
    scenario: label,
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    eventCount,
    checksum,
    attrCountTotal,
    objectCount,
    inputUnits,
    samplesMs,
  };
}

function defaultJsonOut() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(REPORT_DIR, `BUN_FFI_NATIVE_STRING_POC_${stamp}.json`);
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!existsSync(options.file)) {
    throw new Error(`Input file does not exist: ${options.file}`);
  }
  const libraryPath = nativeLibraryPath();
  if (!existsSync(libraryPath)) {
    throw new Error(`Native library does not exist. Run pnpm --filter @stax-xml/native-aggregate-probe build:native first: ${libraryPath}`);
  }

  const bytes = readFileSync(options.file);
  const text = bytes.toString('utf8');
  const fileSizeMiB = bytes.byteLength / 1024 / 1024;
  const runner = createFfiRunner(libraryPath);
  try {
    const preconvertedUnits = stringToUtf16Units(text);
    const scanOnly = measure('bun-ffi-utf16-scan-only', () => runner.parse(preconvertedUnits, options.tier), fileSizeMiB, options);
    const copyAndScan = measure(
      'bun-ffi-string-to-utf16-units-total',
      () => runner.parse(stringToUtf16Units(text), options.tier),
      fileSizeMiB,
      options,
    );

    if (
      scanOnly.eventCount !== copyAndScan.eventCount ||
      scanOnly.checksum !== copyAndScan.checksum ||
      scanOnly.attrCountTotal !== copyAndScan.attrCountTotal
    ) {
      throw new Error('Bun FFI scan-only and copy+scan results diverged');
    }

    const report = {
      generatedAt: new Date().toISOString(),
      runtime: {
        bun: Bun.version,
        platform: process.platform,
        arch: process.arch,
      },
      contract: [
        'bun:ffi calls the Rust C ABI UTF-16 aggregate symbol with a Uint16Array pointer',
        'scan-only excludes the JS string-to-Uint16Array copy',
        'copy+scan includes the JS string-to-Uint16Array copy and is the only product-relevant string diagnostic',
      ],
      input: {
        file: options.file,
        sizeMiB: fileSizeMiB,
        utf16Units: text.length,
        tier: options.tier,
      },
      results: [scanOnly, copyAndScan],
    };

    mkdirSync(REPORT_DIR, { recursive: true });
    const jsonOut = options.jsonOut ?? defaultJsonOut();
    writeFileSync(jsonOut, JSON.stringify(report, null, 2));
    console.log(`bun ffi report: ${jsonOut}`);
    for (const result of report.results) {
      console.log(
        `${result.scenario}: ${result.mibPerSec.toFixed(1)} MiB/s, ${result.avgMs.toFixed(2)} ms, ` +
          `events=${result.eventCount}, attrs=${result.attrCountTotal}, checksum=${result.checksum}`,
      );
    }
  } finally {
    runner.close();
  }
}

main();
