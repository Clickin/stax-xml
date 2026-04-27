import { createHash } from 'node:crypto';
import { createWriteStream, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { get } from 'node:https';
import { StaxXmlParserSync } from '../src/StaxXmlParserSync.js';

const XMLTS_URL = 'https://www.w3.org/XML/Test/xmlts20130923.zip';
const XMLTS_SHA256 = 'f9510b3532926e1b4c2e54855b021e4b8a66ec98a5337dcf4ff07e8a41968deb';
const CACHE_DIR = resolve(import.meta.dirname, '../.cache/w3c');
const ARCHIVE_PATH = join(CACHE_DIR, 'xmlts20130923.zip');
const EXTRACT_DIR = join(CACHE_DIR, 'xmlts20130923');
const XMLCONF_DIR = join(EXTRACT_DIR, 'xmlconf');
const SUPPORTED_ROOTS = [
  'xmltest/',
  'sun/',
  'oasis/',
  'ibm/',
  'eduni/errata-2e/',
  'eduni/errata-3e/',
  'eduni/errata-4e/'
];
const SUPPORTED_NOT_WF_SECTIONS = [
  '2.1',
  '2.2',
  '2.3',
  '2.5',
  '2.6',
  '2.7 [18]',
  '2.7 [19]',
  '3.1 [41]',
  '3.1 [42]',
  '4.1 [66]',
  '4.1 [68]'
];

interface W3cCase {
  id: string;
  type: 'valid' | 'invalid' | 'not-wf';
  uri: string;
  path: string;
  sections: string;
}

interface RunResult {
  passed: number;
  failed: Array<{ test: W3cCase; error: string }>;
  skipped: number;
}

await main();

async function main(): Promise<void> {
  await ensureSuite();
  const tests = await collectTests(XMLCONF_DIR);
  const result = runTests(tests);

  console.log(`W3C XML TS 20130923 document-mode subset`);
  console.log(`archive: ${XMLTS_URL}`);
  console.log(`sha256: ${XMLTS_SHA256}`);
  console.log(`passed: ${result.passed}`);
  console.log(`skipped: ${result.skipped}`);
  console.log(`failed: ${result.failed.length}`);

  for (const failure of result.failed.slice(0, 20)) {
    console.log(`FAIL ${failure.test.id} ${failure.test.type} ${failure.test.uri}: ${failure.error}`);
  }

  if (result.failed.length > 0) {
    process.exitCode = 1;
  }
}

async function ensureSuite(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  if (!(await fileExists(ARCHIVE_PATH))) {
    await download(XMLTS_URL, ARCHIVE_PATH);
  }

  const digest = await sha256File(ARCHIVE_PATH);
  if (digest !== XMLTS_SHA256) {
    throw new Error(`W3C XML Test Suite SHA256 mismatch: expected ${XMLTS_SHA256}, got ${digest}`);
  }

  if (!(await fileExists(XMLCONF_DIR))) {
    await mkdir(EXTRACT_DIR, { recursive: true });
    const unzip = spawnSync('unzip', ['-q', '-o', ARCHIVE_PATH, '-d', EXTRACT_DIR], {
      encoding: 'utf8'
    });
    if (unzip.status !== 0) {
      throw new Error(`Failed to extract W3C XML Test Suite: ${unzip.stderr || unzip.stdout}`);
    }
  }
}

async function download(url: string, destination: string): Promise<void> {
  await pipeline(
    await new Promise<NodeJS.ReadableStream>((resolvePromise, reject) => {
      get(url, response => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with HTTP ${response.statusCode}`));
          response.resume();
          return;
        }
        resolvePromise(response);
      }).on('error', reject);
    }),
    createWriteStream(destination)
  );
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  hash.update(await readFile(path));
  return hash.digest('hex');
}

async function collectTests(root: string): Promise<W3cCase[]> {
  const manifests = await findXmlFiles(root);
  const tests: W3cCase[] = [];

  for (const manifest of manifests) {
    const content = await readFile(manifest, 'utf8');
    if (!content.includes('<TEST')) {
      continue;
    }
    tests.push(...parseManifest(root, manifest, content));
  }

  return dedupeTests(tests).filter(isInGateScope);
}

async function findXmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    const info = await stat(path);
    if (info.isDirectory()) {
      files.push(...await findXmlFiles(path));
    } else if (entry.endsWith('.xml')) {
      files.push(path);
    }
  }
  return files;
}

function parseManifest(root: string, manifest: string, content: string): W3cCase[] {
  const tests: W3cCase[] = [];
  const manifestRelDir = dirname(relative(root, manifest));
  let currentBase = '';
  const tokenRegex = /<TESTCASES\b[^>]*>|<\/TESTCASES>|<TEST\b[^>]*>/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(content))) {
    const token = match[0]!;
    if (token.startsWith('</TESTCASES')) {
      currentBase = '';
      continue;
    }
    if (token.startsWith('<TESTCASES')) {
      currentBase = readAttr(token, 'xml:base') ?? '';
      continue;
    }

    const type = readAttr(token, 'TYPE');
    const uri = readAttr(token, 'URI');
    if ((type !== 'valid' && type !== 'invalid' && type !== 'not-wf') || !uri) {
      continue;
    }

    const relPath = normalize(join(manifestRelDir, currentBase, uri));
    tests.push({
      id: readAttr(token, 'ID') ?? relPath,
      type,
      uri: relPath,
      path: join(root, relPath),
      sections: readAttr(token, 'SECTIONS') ?? ''
    });
  }

  return tests;
}

function readAttr(tag: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`${escaped}\\s*=\\s*"([^"]*)"`, 'i'));
  return match?.[1];
}

function dedupeTests(tests: W3cCase[]): W3cCase[] {
  const seen = new Set<string>();
  const deduped: W3cCase[] = [];
  for (const test of tests) {
    const key = `${test.type}:${test.uri}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(test);
  }
  return deduped;
}

function isInGateScope(test: W3cCase): boolean {
  const uri = test.uri.replaceAll('\\', '/');
  if (!SUPPORTED_ROOTS.some(root => uri.startsWith(root))) {
    return false;
  }
  if (uri.includes('/xml-1.1/') || uri.includes('/namespaces/')) {
    return false;
  }
  if (test.type === 'not-wf') {
    if (/\/P\d+\//.test(uri)) {
      return false;
    }
    return SUPPORTED_NOT_WF_SECTIONS.some(section => test.sections.includes(section));
  }
  return true;
}

function runTests(tests: W3cCase[]): RunResult {
  const result: RunResult = { passed: 0, failed: [], skipped: 0 };

  for (const test of tests) {
    let bytes: Buffer;
    try {
      bytes = readFileSync(test.path);
    } catch {
      result.skipped++;
      continue;
    }
    if (isUtf16(bytes)) {
      result.skipped++;
      continue;
    }
    if (hasUnsupportedRawDeclaration(bytes)) {
      result.skipped++;
      continue;
    }

    let xml: string;
    try {
      xml = decodeUtf8(bytes);
    } catch (error) {
      if (test.type === 'not-wf') {
        result.passed++;
        continue;
      }
      result.failed.push({
        test,
        error: error instanceof Error ? error.message : String(error)
      });
      continue;
    }
    if (isUnsupportedXmlVersion(xml)) {
      result.skipped++;
      continue;
    }
    if (test.type === 'not-wf' && /<!DOCTYPE/i.test(xml)) {
      result.skipped++;
      continue;
    }

    let threw = false;
    let error = '';
    try {
      Array.from(new StaxXmlParserSync(xml, { documentMode: 'document' }));
    } catch (cause) {
      threw = true;
      error = cause instanceof Error ? cause.message : String(cause);
    }

    const shouldThrow = test.type === 'not-wf';
    if (threw === shouldThrow) {
      result.passed++;
    } else {
      result.failed.push({
        test,
        error: shouldThrow ? 'expected parse failure, but parsing succeeded' : error
      });
    }
  }

  return result;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
    .decode(bytes);
}

function isUtf16(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 2
    && (
      bytes[0] === 0xfe && bytes[1] === 0xff
      || bytes[0] === 0xff && bytes[1] === 0xfe
      || bytes.subarray(0, Math.min(bytes.byteLength, 64)).includes(0)
    );
}

function isUnsupportedXmlVersion(xml: string): boolean {
  const match = xml.match(/^\uFEFF?\s*<\?xml\s+[^?]*version\s*=\s*["']([^"']+)["']/i);
  return match !== null && match[1] !== '1.0';
}

function hasUnsupportedRawDeclaration(bytes: Uint8Array): boolean {
  const prefix = String.fromCharCode(...bytes.subarray(0, Math.min(bytes.byteLength, 256)));
  const declaration = prefix.match(/^\uFEFF?\s*<\?xml\s+([^?]*)\?>/i)?.[1];
  if (!declaration) {
    return false;
  }
  const version = declaration.match(/\bversion\s*=\s*["']([^"']+)["']/i)?.[1];
  if (version && version !== '1.0') {
    return true;
  }
  const encoding = declaration.match(/\bencoding\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
  return Boolean(encoding && encoding !== 'utf-8' && encoding !== 'utf8' && encoding !== 'us-ascii');
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
