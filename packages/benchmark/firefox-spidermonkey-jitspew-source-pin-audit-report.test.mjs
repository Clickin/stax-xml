import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-jitspew-source-pin-fixture');
const jsonOut = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-jitspew-source-pin-audit-test.json');
const mdOut = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-jitspew-source-pin-audit-test.md');

test('Firefox/SpiderMonkey JitSpew source-pin audit records diagnostic compile gates', () => {
  rmSync(tmpDir, { recursive: true, force: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
  mkdirSync(join(tmpDir, 'js', 'src', 'jit'), { recursive: true });
  mkdirSync(join(tmpDir, 'js', 'src'), { recursive: true });
  mkdirSync(join(tmpDir, 'js'), { recursive: true });

  writeFileSync(join(tmpDir, 'js', 'src', 'jit', 'JitSpewer.h'), [
    '// The JitSpewer is only available on debug builds.',
    '#ifdef JS_JITSPEW',
    'void JitSpew(JitSpewChannel channel, const char* fmt, ...);',
    '#else',
    'class GraphSpewer { bool isSpewing() { return false; } };',
    'static inline bool JitSpewEnabled(JitSpewChannel channel) { return false; }',
    '#endif /* JS_JITSPEW */',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'js', 'src', 'jit', 'JitSpewer.cpp'), [
    '#ifdef JS_JITSPEW',
    '#  ifndef JIT_SPEW_DIR',
    '#  define JIT_SPEW_DIR "/tmp"',
    '#  endif',
    'fprintf(stderr, "usage: IONFLAGS=option,option,option,... where options can be:\\n");',
    'char* env = getenv("IONFLAGS");',
    'const char* filename = getenv("ION_SPEW_FILENAME");',
    'EnableChannel(JitSpew_Codegen);',
    '#endif /* JS_JITSPEW */',
    '#if defined(JS_JITSPEW) || defined(ENABLE_JS_AOT_ICS)',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'js', 'moz.configure'), [
    'option(',
    '    "--enable-jitspew",',
    '    help="{Enable|Disable} the Jit spew and IONFLAGS environment " "variable",',
    ')',
    'set_define("JS_JITSPEW", depends_if("--enable-jitspew")(lambda _: True))',
    'set_config("JS_JITSPEW", depends_if("--enable-jitspew")(lambda _: True))',
    '# Also enable the structured spewer',
    'set_define("JS_STRUCTURED_SPEW", depends_if("--enable-jitspew")(lambda _: True))',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'js', 'src', 'moz.build'), [
    'if CONFIG["JS_JITSPEW"]:',
    '    SOURCES += ["jit/ExecutableAllocatorPosix.cpp"]',
  ].join('\n'));

  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-jitspew-source-pin-audit.mjs'),
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
  assert.equal(report.objective, 'firefox-spidermonkey-jitspew-source-pin-audit');
  assert.equal(report.contract, 'spidermonkey-exact-revision-jitspew-source-lines');
  assert.equal(report.environment.firefoxVersion, '143.0.1 build 20250918214338 test snapshot');
  assert.equal(report.anchors.jsJitSpewHeaderIfdef.status, 'found');
  assert.equal(report.anchors.emptyJitSpewEnabled.status, 'found');
  assert.equal(report.anchors.configureDefineJsJitSpew.status, 'found');
  assert.ok(report.findings.some(entry => entry.id === 'spidermonkey-jitspew-compile-gate-source-pin'));
  assert.ok(report.findings.some(entry => entry.id === 'spidermonkey-ionflags-source-pin'));
  assert.ok(report.findings.some(entry => entry.id === 'spidermonkey-jitspew-scope-guard'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Firefox\/SpiderMonkey JitSpew Source Pin Audit/);
  assert.match(markdown, /JS_JITSPEW/);
  assert.match(markdown, /IONFLAGS/);
  assert.match(markdown, /not emitted JIT IR/);
});
