import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'deno-textdecoder-source-pin-fixture');
const jsonOut = join(__dirname, 'results', 'tmp', 'deno-textdecoder-source-pin-audit-test.json');
const mdOut = join(__dirname, 'results', 'tmp', 'deno-textdecoder-source-pin-audit-test.md');

test('Deno TextDecoder source-pin audit records the UTF-8 op boundary without claiming a ceiling', () => {
  rmSync(tmpDir, { recursive: true, force: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
  mkdirSync(join(tmpDir, 'ext', 'web'), { recursive: true });

  writeFileSync(join(tmpDir, 'ext', 'web', '08_text_encoding.js'), [
    'import {',
    '  op_encoding_decode,',
    '  op_encoding_decode_single,',
    '  op_encoding_decode_utf8,',
    '  op_encoding_new_decoder,',
    '} from "ext:core/ops";',
    'class TextDecoder {',
    '  constructor(label = "utf-8", options = { __proto__: null }) {',
    '    // Fast path for common UTF-8 labels - avoid Rust op call',
    '    this.#utf8SinglePass = encoding === "utf-8" && !options.fatal;',
    '  }',
    '  decode(input = new Uint8Array(), options = undefined) {',
    '    // Fast path: skip full BufferSource validation for Uint8Array',
    '    buffer = TypedArrayPrototypeGetBuffer(input);',
    '    // We clone the data into a non-shared ArrayBuffer so we can pass it',
    '    // to Rust.',
    '    // Fast path for single pass encoding.',
    '    if (this.#utf8SinglePass) {',
    '      return op_encoding_decode_utf8(input, this.#ignoreBOM);',
    '    }',
    '    return op_encoding_decode_single(',
    '      input,',
    '      this.#encoding,',
    '      this.#fatal,',
    '      this.#ignoreBOM,',
    '    );',
    '    this.#handle = op_encoding_new_decoder(',
    '      this.#encoding,',
    '      this.#fatal,',
    '      this.#ignoreBOM,',
    '    );',
    '    return op_encoding_decode(input, this.#handle, stream);',
    '  }',
    '}',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'ext', 'web', 'lib.rs'), [
    'deno_core::extension!(deno_web,',
    '  ops = [',
    '    op_encoding_decode_utf8,',
    '    op_encoding_decode_single,',
    '    op_encoding_new_decoder,',
    '    op_encoding_decode,',
    '  ],',
    ');',
    '#[op2]',
    "fn op_encoding_decode_utf8<'a>(",
    "  scope: &mut v8::PinScope<'a, '_>,",
    '  #[anybuffer] zero_copy: &[u8],',
    '  ignore_bom: bool,',
    ") -> Result<v8::Local<'a, v8::String>, WebError> {",
    '  let buf = &zero_copy;',
    '  let buf = if !ignore_bom && buf.len() >= 3 && buf[0] == 0xef { &buf[3..] } else { buf };',
    '  match v8::String::new_from_utf8(scope, buf, v8::NewStringType::Normal) {',
    '    Some(text) => Ok(text),',
    '    None => Err(WebError::BufferTooLong),',
    '  }',
    '}',
    '#[op2]',
    'fn op_encoding_decode_single(',
    '  #[anybuffer] data: &[u8],',
    '  #[string] label: String,',
    '  fatal: bool,',
    '  ignore_bom: bool,',
    ') -> Result<U16String, WebError> {',
    '  let max_buffer_length = decoder',
    '    .max_utf16_buffer_length(data.len())',
    '    .ok_or(WebError::ValueTooLarge)?;',
    '  let mut output = vec![0; max_buffer_length];',
    '  decoder.decode_to_utf16(data, &mut output, true);',
    '  Ok(output.into())',
    '}',
    '#[op2]',
    'fn op_encoding_decode(',
    '  #[anybuffer] data: &[u8],',
    '  #[cppgc] resource: &TextDecoderResource,',
    '  stream: bool,',
    ') -> Result<U16String, WebError> {',
    '  Ok(vec![].into())',
    '}',
    'struct TextDecoderResource {',
    '  decoder: RefCell<Decoder>,',
    '  fatal: bool,',
    '}',
  ].join('\n'));

  const result = spawnSync(process.execPath, [
    join(__dirname, 'deno-textdecoder-source-pin-audit.mjs'),
    '--source-dir',
    tmpDir,
    '--revision',
    'v2.7.13-test',
    '--deno-version',
    '2.7.13',
    '--v8-version',
    '14.7.173.20-rusty',
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
  assert.equal(report.objective, 'deno-textdecoder-source-pin-audit');
  assert.equal(report.contract, 'deno-exact-revision-textdecoder-string-boundary-source-lines');
  assert.equal(report.runtime.denoVersion, '2.7.13');
  assert.equal(report.runtime.v8Version, '14.7.173.20-rusty');
  assert.equal(report.source.revision, 'v2.7.13-test');
  assert.equal(report.anchors.decodeMethod.status, 'found');
  assert.equal(report.anchors.utf8OpCall.status, 'found');
  assert.equal(report.anchors.rustAnybufferInput.status, 'found');
  assert.equal(report.anchors.rustNewFromUtf8.status, 'found');
  assert.ok(report.findings.some(entry => entry.id === 'deno-textdecoder-v8-string-creation-source-pin'));
  assert.ok(report.findings.some(entry => entry.id === 'deno-textdecoder-source-pin-scope-guard'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Deno TextDecoder Source Pin Audit/);
  assert.match(markdown, /op_encoding_decode_utf8/);
  assert.match(markdown, /v8::String::new_from_utf8/);
  assert.match(markdown, /not codegen evidence/);
  assert.match(markdown, /impossibility proof/);
});
