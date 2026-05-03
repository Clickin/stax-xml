import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventReaderSync } from '../stax-xml/src/EventReaderSync.ts';
import { StringCurrentCursorSync } from '../stax-xml/src/StringCurrentCursorSync.ts';
import { StringEventParserSync } from '../stax-xml/src/StringEventParserSync.ts';
import { XmlEventType } from '../stax-xml/src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const WARMUP_COMPLETE_MARKER = '[stax-v8-string-cursor] warmup-complete';

const CASE_IDS = [
  'event-reader-sync-lean',
  'string-parser-sync-lean',
  'string-current-cursor-none',
  'string-current-cursor-current-event',
  'string-current-cursor-eager-touch',
];

const TARGET_FUNCTIONS = [
  'next',
  'parseNextEvent',
  'parseStartTag',
  'parseEndTag',
  'parsePlainAttributesFast',
  'cursorParseNext',
  'cursorParseStartTag',
  'cursorParseEndTag',
  'cursorHydrateCurrentEventStrings',
  'getAttributeValueByIndex',
  'getAttributeValueByName',
];

globalThis.__staxXmlStringCursorTraceSink = 0;

const args = parseArgs(process.argv.slice(2));

if (args.mode === 'driver') {
  runDriver(args);
} else {
  runTraceCase(args);
}

function parseArgs(argv) {
  const result = {
    mode: 'driver',
    caseId: 'string-current-cursor-current-event',
    functions: [...TARGET_FUNCTIONS],
    outputDir: join(__dirname, 'results', 'v8-string-cursor', String(Date.now())),
    warmups: 120,
    iterations: 24,
    elements: 512,
    skipBytecode: false,
    skipOptCode: false,
    skipTrace: false,
    quick: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--quick') {
      result.quick = true;
      result.warmups = 20;
      result.iterations = 4;
      result.elements = 96;
      continue;
    }

    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--mode':
        result.mode = readValue();
        break;
      case '--case':
        result.caseId = readValue();
        break;
      case '--functions':
        result.functions = readValue().split(',').map((entry) => entry.trim()).filter(Boolean);
        break;
      case '--output-dir':
        result.outputDir = resolve(process.cwd(), readValue());
        break;
      case '--warmups':
        result.warmups = Number(readValue());
        break;
      case '--iterations':
        result.iterations = Number(readValue());
        break;
      case '--elements':
        result.elements = Number(readValue());
        break;
      case '--skip-bytecode':
        result.skipBytecode = true;
        break;
      case '--skip-opt-code':
        result.skipOptCode = true;
        break;
      case '--skip-trace':
        result.skipTrace = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!CASE_IDS.includes(result.caseId)) {
    throw new Error(`--case must be one of: ${CASE_IDS.join(', ')}`);
  }
  return result;
}

function runDriver(options) {
  mkdirSync(options.outputDir, { recursive: true });
  const artifacts = [];

  if (!options.skipTrace) {
    artifacts.push(runTraceProcess(options, {
      kind: 'trace',
      flags: ['--allow-natives-syntax', '--trace-opt', '--trace-deopt', '--trace-file-names'],
      fileName: `${options.caseId}-trace.log`,
    }));
  }

  for (const functionName of options.functions) {
    if (!options.skipBytecode) {
      artifacts.push(runTraceProcess(options, {
        kind: 'bytecode',
        functionName,
        flags: ['--print-bytecode', `--print-bytecode-filter=${functionName}`],
        fileName: `${options.caseId}-${functionName}-bytecode.log`,
      }));
    }
    if (!options.skipOptCode) {
      artifacts.push(runTraceProcess(options, {
        kind: 'optcode',
        functionName,
        flags: [
          '--allow-natives-syntax',
          '--print-opt-code',
          `--print-opt-code-filter=${functionName}`,
          '--print-opt-source',
        ],
        fileName: `${options.caseId}-${functionName}-optcode.log`,
      }));
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    v8: process.versions.v8,
    caseId: options.caseId,
    functions: options.functions,
    warmups: options.warmups,
    iterations: options.iterations,
    elements: options.elements,
    artifacts,
  };

  const manifestPath = join(options.outputDir, 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`V8 string/cursor traces saved to ${options.outputDir}`);
  console.log(`Manifest: ${manifestPath}`);
}

function runTraceProcess(options, trace) {
  const logPath = join(options.outputDir, trace.fileName);
  const args = [
    ...trace.flags,
    '--import',
    'tsx',
    __filename,
    '--mode=run',
    `--case=${options.caseId}`,
    `--warmups=${options.warmups}`,
    `--iterations=${options.iterations}`,
    `--elements=${options.elements}`,
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 256 * 1024 * 1024,
  });
  writeFileSync(logPath, [
    `$ ${[process.execPath, ...args].join(' ')}`,
    `cwd=${REPO_ROOT}`,
    `exit=${result.status}`,
    '',
    '--- stdout ---',
    result.stdout ?? '',
    '',
    '--- stderr ---',
    result.stderr ?? '',
  ].join('\n'));

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${trace.kind} failed for ${options.caseId}${trace.functionName ? `/${trace.functionName}` : ''}. See ${logPath}`);
  }
  return {
    kind: trace.kind,
    functionName: trace.functionName,
    logPath,
    bytes: existsSync(logPath) ? readFileSync(logPath, 'utf8').length : 0,
  };
}

function runTraceCase(options) {
  const xml = buildFixture(options.elements);
  for (let index = 0; index < options.warmups + options.iterations; index++) {
    consumeCase(options.caseId, xml);
    if (index + 1 === options.warmups) {
      console.log(WARMUP_COMPLETE_MARKER);
    }
  }
  console.log(JSON.stringify({
    caseId: options.caseId,
    warmups: options.warmups,
    iterations: options.iterations,
    elements: options.elements,
    sink: globalThis.__staxXmlStringCursorTraceSink >>> 0,
  }));
}

function consumeCase(caseId, xml) {
  switch (caseId) {
    case 'event-reader-sync-lean':
      consumeEventReaderSyncLean(xml);
      return;
    case 'string-parser-sync-lean':
      consumeStringParserSyncLean(xml);
      return;
    case 'string-current-cursor-none':
      consumeStringCursor(xml, 'none');
      return;
    case 'string-current-cursor-current-event':
      consumeStringCursor(xml, 'current-event');
      return;
    case 'string-current-cursor-eager-touch':
      consumeStringCursor(xml, 'eager-touch');
      return;
    default:
      throw new Error(`Unknown case: ${caseId}`);
  }
}

function consumeEventReaderSyncLean(xml) {
  const parser = new EventReaderSync(xml, { namespaceAware: false, autoDecodeEntities: false });
  let sink = globalThis.__staxXmlStringCursorTraceSink >>> 0;
  for (const event of parser) {
    sink = mixEvent(sink, event.type === XmlEventType.START_DOCUMENT ? 0 : event.type === XmlEventType.END_DOCUMENT ? 1 : event.type === XmlEventType.START_ELEMENT ? 2 : event.type === XmlEventType.END_ELEMENT ? 3 : event.type === XmlEventType.CHARACTERS ? 4 : 5);
    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      sink = foldString(sink, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      sink = foldString(sink, event.value);
    }
    if (event.type === XmlEventType.START_ELEMENT) {
      for (const [name, value] of Object.entries(event.attributes ?? {})) {
        sink = foldString(sink, name);
        sink = foldString(sink, value);
      }
    }
  }
  globalThis.__staxXmlStringCursorTraceSink = sink >>> 0;
}

function consumeStringParserSyncLean(xml) {
  const parser = new StringEventParserSync(xml, {
    namespaceAware: false,
    autoDecodeEntities: false,
  });
  let sink = globalThis.__staxXmlStringCursorTraceSink >>> 0;
  for (const event of parser) {
    sink = mixEvent(sink, event.type === XmlEventType.START_DOCUMENT ? 0 : event.type === XmlEventType.END_DOCUMENT ? 1 : event.type === XmlEventType.START_ELEMENT ? 2 : event.type === XmlEventType.END_ELEMENT ? 3 : event.type === XmlEventType.CHARACTERS ? 4 : 5);
    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      sink = foldString(sink, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      sink = foldString(sink, event.value);
    }
    if (event.type === XmlEventType.START_ELEMENT) {
      for (const [name, value] of Object.entries(event.attributes ?? {})) {
        sink = foldString(sink, name);
        sink = foldString(sink, value);
      }
    }
  }
  globalThis.__staxXmlStringCursorTraceSink = sink >>> 0;
}

function consumeStringCursor(xml, materialization) {
  const cursor = new StringCurrentCursorSync(xml, { materialization });
  let sink = globalThis.__staxXmlStringCursorTraceSink >>> 0;
  while (cursor.next()) {
    const type = cursor.eventType();
    sink = mixEvent(sink, type);
    if (type === 2 || type === 3) {
      sink = foldString(sink, cursor.name());
    }
    if (type === 4 || type === 5) {
      sink = foldString(sink, cursor.text());
    }
    if (type === 2) {
      for (let index = 0; index < cursor.getAttributeCount(); index++) {
        sink = foldString(sink, cursor.getAttributeName(index));
        sink = foldString(sink, cursor.getAttributeValue(index));
      }
    }
  }
  globalThis.__staxXmlStringCursorTraceSink = sink >>> 0;
}

function buildFixture(elements) {
  let xml = '<root>';
  for (let index = 0; index < elements; index++) {
    xml += `<book id="book-${index}" lang="en" code="${index % 97}" checked><title>Compact ${index}</title><author>Author ${index % 4096}</author><description>Stable text payload ${index}</description><chapter number="1">Intro ${index}</chapter><chapter number="2">Body ${index}</chapter></book>`;
  }
  xml += '</root>';
  return xml;
}

function mixEvent(checksum, value) {
  return Math.imul(checksum ^ (value >>> 0), 16777619) >>> 0;
}

function foldString(seed, value) {
  if (!value) return seed >>> 0;
  let next = seed >>> 0;
  for (let index = 0; index < value.length; index++) {
    next = Math.imul(next ^ value.charCodeAt(index), 16777619) >>> 0;
  }
  return next;
}
