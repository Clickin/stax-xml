import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const fixtureDir = join(tmpDir, 'jsc-source-pin-fixture');
const jsonOut = join(tmpDir, 'bun-jsc-source-pin-audit-report-test.json');
const mdOut = join(tmpDir, 'bun-jsc-source-pin-audit-report-test.md');

test('bun jsc source pin audit records engine-owned string boundary anchors', () => {
  mkdirSync(tmpDir, { recursive: true });
  if (existsSync(fixtureDir)) {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  writeFixture('Source/JavaScriptCore/runtime/JSString.h', [
    '// fixture',
    'class JSString : public JSCell {',
    '    static constexpr unsigned MaxLength = std::numeric_limits<int32_t>::max();',
    '    String& valueInternal() const { return *std::bit_cast<String*>(&m_fiber); }',
    '    JSString(VM& vm, Ref<StringImpl>&& value)',
    '    {',
    '        new (&uninitializedValueInternal()) String(WTF::move(value));',
    '    }',
    '    static JSString* create(VM& vm, Ref<StringImpl>&& value)',
    '    {',
    '        JSString* newString = new (NotNull, allocateCell<JSString>(vm)) JSString(vm, WTF::move(value));',
    '        return newString;',
    '    }',
    '    GCOwnedDataScope<StringView> view(JSGlobalObject*) const { return { this, valueInternal() }; }',
    '    mutable uintptr_t m_fiber;',
    '};',
  ]);
  writeFixture('Source/WTF/wtf/text/WTFString.h', [
    '// fixture',
    'class String final {',
    'public:',
    '    static constexpr unsigned MaxLength = StringImpl::MaxLength;',
    '    static String createUninitialized(unsigned length, std::span<char16_t>& data) { return StringImpl::createUninitialized(length, data); }',
    'private:',
    '    RefPtr<StringImpl> m_impl;',
    '};',
  ]);
  writeFixture('Source/WTF/wtf/text/StringImpl.h', [
    '// fixture',
    'class StringImplShape {',
    'public:',
    '    static constexpr unsigned MaxLength = std::numeric_limits<int32_t>::max();',
    '};',
    'class StringImpl {',
    'public:',
    '    enum BufferOwnership { BufferInternal, BufferOwned, BufferSubstring, BufferExternal };',
    '    template<typename> static constexpr bool isValidLength(size_t);',
    '    static constexpr unsigned MaxLength = StringImplShape::MaxLength;',
    '    WTF_EXPORT_PRIVATE static Ref<StringImpl> create(std::span<const char16_t>);',
    '    static Ref<StringImpl> createWithoutCopying(std::span<const char16_t> characters) { return characters.empty() ? Ref { *empty() } : createWithoutCopyingNonEmpty(characters); }',
    '    template<typename CharacterType> static RefPtr<StringImpl> tryCreateUninitialized(size_t length, std::span<CharacterType>&);',
    '};',
  ]);
  writeFixture('Source/WTF/wtf/text/StringImpl.cpp', [
    '// fixture',
    'template<typename CharacterType> inline Ref<StringImpl> StringImpl::createInternal(std::span<const CharacterType> characters)',
    '{',
    '    std::span<CharacterType> data;',
    '    auto string = createUninitializedInternalNonEmpty(characters.size(), data);',
    '    copyCharacters(data, characters);',
    '    return string;',
    '}',
    'Ref<StringImpl> StringImpl::create8BitIfPossible(std::span<const char16_t> characters)',
    '{',
    '    Ref string = createUninitializedInternalNonEmpty(characters.size(), data);',
    '    copyElements(data, characters);',
    '    return string;',
    '}',
  ]);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'bun-jsc-source-pin-audit.mjs'),
    '--source-dir',
    fixtureDir,
    '--webkit-commit',
    'test-webkit-commit',
    '--bun-version',
    '1.3.test',
    '--bun-revision',
    '1.3.test+abcdef',
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
  assert.equal(report.objective, 'bun-jsc-source-pin-audit');
  assert.equal(report.contract, 'bun-jsc-exact-webkit-string-boundary-source-lines');
  assert.equal(report.source.repository, 'oven-sh/webkit');
  assert.equal(report.source.revision, 'test-webkit-commit');
  assert.equal(report.runtime.bunVersion, '1.3.test');
  assert.equal(report.anchors.jsStringClass.lineNumber, 2);
  assert.equal(report.anchors.jsStringConstructorStoresString.lineNumber, 7);
  assert.equal(report.anchors.jsStringAllocateCell.lineNumber, 11);
  assert.equal(report.anchors.wtfStringImplPointer.lineNumber, 7);
  assert.equal(report.anchors.stringImplMaxLength.lineNumber, 4);
  assert.equal(report.anchors.stringImplCreateCopyCharacters.lineNumber, 6);
  assert.equal(report.findings.find((finding) => finding.id === 'jsc-jsstring-engine-cell-source-pin').classification, 'SOURCE_FACT');
  assert.equal(report.findings.find((finding) => finding.id === 'source-pin-not-throughput-proof').classification, 'SCOPE_GUARD');

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Bun\/JSC Source Pin Audit/);
  assert.match(markdown, /JSString/);
  assert.match(markdown, /StringImpl/);
  assert.match(markdown, /copyCharacters/);
  assert.match(markdown, /engine-owned string boundary/);
  assert.match(markdown, /not a throughput proof/);
});

function writeFixture(relativePath, lines) {
  const filePath = join(fixtureDir, ...relativePath.split('/'));
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${lines.join('\n')}\n`);
}
