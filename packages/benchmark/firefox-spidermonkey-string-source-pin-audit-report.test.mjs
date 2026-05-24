import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-string-source-pin-fixture');
const jsonOut = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-string-source-pin-audit-test.json');
const mdOut = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-string-source-pin-audit-test.md');

test('Firefox/SpiderMonkey string source-pin audit records JSString and copy boundaries', () => {
  rmSync(tmpDir, { recursive: true, force: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
  mkdirSync(join(tmpDir, 'js', 'src', 'vm'), { recursive: true });
  mkdirSync(join(tmpDir, 'js', 'public'), { recursive: true });

  writeFileSync(join(tmpDir, 'js', 'src', 'vm', 'StringType.h'), [
    '/*',
    ' * [SMDOC] JavaScript Strings',
    ' * Conceptually, a JS string is just an array of chars and a length.',
    ' */',
    'class JSString : public js::gc::CellWithLengthAndFlags {',
    '  // chars_ is a buffer allocated in the malloc heap.',
    '  // chars_ is allocated as a refcounted StringBuffer.',
    '};',
    'class JSLinearString : public JSString {',
    '  // Make sure chars are not in the nursery, mallocing and copying if necessary.',
    '};',
    'extern JSLinearString* NewStringCopyN(JSContext* cx, const CharT* s, size_t n, js::gc::Heap heap);',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'js', 'src', 'vm', 'StringType.cpp'), [
    'JSLinearString* NewStringCopyNDontDeflateNonStaticValidLength(JSContext* cx, const CharT* s, size_t n, gc::Heap heap) {',
    '  Rooted<JSString::OwnedChars<CharT>> news(cx, ::AllocChars<CharT>(cx, n, heap));',
    '  PodCopy(news.data(), s, n);',
    '  return JSLinearString::newValidLength<allowGC, CharT>(cx, &news, heap);',
    '}',
    'JSLinearString* NewStringCopyN(JSContext* cx, const CharT* s, size_t n, gc::Heap heap) {',
    '  if (CanStoreCharsAsLatin1(s, n)) return NewStringDeflated<allowGC>(cx, s, n, heap);',
    '}',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'js', 'src', 'vm', 'StringType-inl.h'), [
    'static MOZ_ALWAYS_INLINE JSInlineString* AllocateInlineString(JSContext* cx, size_t len, CharT** chars, js::gc::Heap heap) { return nullptr; }',
    'inline JSExternalString::JSExternalString(const char16_t* chars, size_t length, const JSStringFinalizer* fin) {}',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'js', 'public', 'String.h'), [
    '/* all the JS_New*StringCopy* functions do not take ownership of the character memory passed to them -- they copy it. */',
    'extern JS_PUBLIC_API JSString* JS_NewStringCopyN(JSContext* cx, const char* s, size_t n);',
    'extern JS_PUBLIC_API JSString* JS_NewStringCopyUTF8N(JSContext* cx, const JS::UTF8Chars& s);',
    'extern JS_PUBLIC_API const JS::Latin1Char* JS_GetLatin1StringCharsAndLength(JSContext* cx, const JS::AutoRequireNoGC& nogc, JSString* str, size_t* length);',
    'extern JS_PUBLIC_API bool JS_CopyStringChars(JSContext* cx, const mozilla::Range<char16_t>& dest, JSString* str);',
    '/** If the provided string is backed by a StringBuffer for char16_t storage, return true. */',
  ].join('\n'));

  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-string-source-pin-audit.mjs'),
    '--source-dir',
    tmpDir,
    '--revision',
    '644b498d517849c3fb95679e2017e965fe62b77a-test',
    '--firefox-version',
    '143.0.1 build 20250918214338 test snapshot',
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'firefox-spidermonkey-string-source-pin-audit');
  assert.equal(report.contract, 'spidermonkey-exact-revision-string-source-lines');
  assert.equal(report.environment.firefoxVersion, '143.0.1 build 20250918214338 test snapshot');
  assert.equal(report.anchors.jsStringClass.status, 'found');
  assert.equal(report.anchors.newStringCopyNImpl.status, 'found');
  assert.equal(report.anchors.podCopy.status, 'found');
  assert.equal(report.anchors.publicCopyComment.status, 'found');
  assert.ok(report.findings.some(entry => entry.id === 'spidermonkey-jsstring-representation-source-pin'));
  assert.ok(report.findings.some(entry => entry.id === 'spidermonkey-string-copy-boundary-source-pin'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Firefox\/SpiderMonkey String Source Pin Audit/);
  assert.match(markdown, /JSString/);
  assert.match(markdown, /NewStringCopyN/);
  assert.match(markdown, /PodCopy/);
  assert.match(markdown, /not a benchmark, allocation profile, or runtime ceiling proof/);
});
