import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  WASM_PACKAGE_NAME,
  detectRuntimePlatform,
  getStaxXmlNativePackageName,
  resolveStaxXmlRuntimeBackend,
  type StaxXmlRuntimePlatform
} from '../src/runtime';

const __dirname = dirname(fileURLToPath(import.meta.url));
const staxPackage = readPackage('../package.json');

const platformPackages = [
  {
    dir: 'native-linux-x64-gnu',
    name: '@stax-xml/native-linux-x64-gnu',
    os: ['linux'],
    cpu: ['x64'],
    libc: ['glibc'],
    files: ['index.mjs', 'stax_xml_native.node', 'README.md', 'LICENSE']
  },
  {
    dir: 'native-linux-x64-musl',
    name: '@stax-xml/native-linux-x64-musl',
    os: ['linux'],
    cpu: ['x64'],
    libc: ['musl'],
    files: ['index.mjs', 'stax_xml_native.node', 'README.md', 'LICENSE']
  },
  {
    dir: 'native-linux-arm64-gnu',
    name: '@stax-xml/native-linux-arm64-gnu',
    os: ['linux'],
    cpu: ['arm64'],
    libc: ['glibc'],
    files: ['index.mjs', 'stax_xml_native.node', 'README.md', 'LICENSE']
  },
  {
    dir: 'native-linux-arm64-musl',
    name: '@stax-xml/native-linux-arm64-musl',
    os: ['linux'],
    cpu: ['arm64'],
    libc: ['musl'],
    files: ['index.mjs', 'stax_xml_native.node', 'README.md', 'LICENSE']
  },
  {
    dir: 'native-darwin-x64',
    name: '@stax-xml/native-darwin-x64',
    os: ['darwin'],
    cpu: ['x64'],
    files: ['index.mjs', 'stax_xml_native.node', 'README.md', 'LICENSE']
  },
  {
    dir: 'native-darwin-arm64',
    name: '@stax-xml/native-darwin-arm64',
    os: ['darwin'],
    cpu: ['arm64'],
    files: ['index.mjs', 'stax_xml_native.node', 'README.md', 'LICENSE']
  },
  {
    dir: 'native-win32-x64-msvc',
    name: '@stax-xml/native-win32-x64-msvc',
    os: ['win32'],
    cpu: ['x64'],
    files: ['index.mjs', 'stax_xml_native.node', 'README.md', 'LICENSE']
  },
  {
    dir: 'native-win32-arm64-msvc',
    name: '@stax-xml/native-win32-arm64-msvc',
    os: ['win32'],
    cpu: ['arm64'],
    files: ['index.mjs', 'stax_xml_native.node', 'README.md', 'LICENSE']
  },
  {
    dir: 'native-wasm32-wasi',
    name: WASM_PACKAGE_NAME,
    cpu: ['wasm32'],
    files: [
      'index.mjs',
      'index.d.ts',
      'stax_xml_native.wasi.cjs',
      'stax_xml_native.wasi-browser.js',
      'stax_xml_native.wasm32-wasi.wasm',
      'wasi-worker.mjs',
      'wasi-worker-browser.mjs',
      'README.md',
      'LICENSE'
    ]
  }
] as const;

describe('runtime backend package topology', () => {
  it('does not auto-install native platform packages through the public stax-xml facade', () => {
    expect(staxPackage.optionalDependencies ?? {}).toEqual({});
  });

  it('keeps retired low-level reader entries out of public package exports', () => {
    expect(staxPackage.exports).not.toHaveProperty('./cursor');
    expect(staxPackage.exports).not.toHaveProperty('./iterable');
    expect(staxPackage.exports).not.toHaveProperty('./iterable/node');
  });

  it('keeps platform package metadata constrained to the intended artifact', () => {
    for (const expected of platformPackages) {
      const manifest = readPackage(`../../${expected.dir}/package.json`);
      const index = readText(`../../${expected.dir}/index.mjs`);

      expect(manifest.name).toBe(expected.name);
      expect(manifest.version).toBe(staxPackage.version);
      if ('os' in expected) {
        expect(manifest.os).toEqual(expected.os);
      } else {
        expect(manifest.os).toBeUndefined();
      }
      expect(manifest.cpu).toEqual(expected.cpu);
      expect(manifest.files).toEqual(expected.files);
      expect(manifest.publishConfig).toEqual({ access: 'public' });
      expect(manifest.private).toBeUndefined();

      if ('libc' in expected) {
        expect(manifest.libc).toEqual(expected.libc);
      } else {
        expect(manifest.libc).toBeUndefined();
      }

      expect(index).toContain('parseStructuralIndexUint8Array');
      expect(index).toContain('parseItemRowsViaTableUint8Array');
      expect(index).toContain('parseObjectRowsUint8Array');
      expect(index).toContain('parseObjectRowsViaTableUint8Array');
    }
  });

  it('smokes staged platform packages through structural projection exports', () => {
    const workflow = readText('../../../.github/workflows/native-binary-smoke.yml');
    const script = readText('../../native-aggregate/scripts/smoke-platform-package.mjs');

    expect(workflow).toContain('scripts/smoke-platform-package.mjs');
    expect(script).toContain('parseObjectRowsUint8Array');
    expect(script).toContain('parseObjectRowsViaTableUint8Array');
  });

  it('keeps the simdxml comparator opt-in and size capped', () => {
    const nodeStringReturn = readText('../../benchmark/node-string-return.mjs');
    const crossRuntime = readText('../../benchmark/cross-runtime-comparison.mjs');

    expect(nodeStringReturn).toContain('--simdxml-cmd');
    expect(nodeStringReturn).toContain('--simdxml-max-mib');
    expect(nodeStringReturn).toContain("measureExternal('simdxml'");
    expect(crossRuntime).toContain('simdxml-bench');
    expect(crossRuntime).toContain('simdxmlMaxMiB');
    expect(crossRuntime).toContain('simdxml structural index');
  });
});

describe('runtime backend resolver', () => {
  it('maps supported platforms to their native packages', () => {
    const cases: Array<[StaxXmlRuntimePlatform, string | undefined]> = [
      [{ platform: 'linux', arch: 'x64', libc: 'gnu' }, '@stax-xml/native-linux-x64-gnu'],
      [{ platform: 'linux', arch: 'x64', libc: 'musl' }, '@stax-xml/native-linux-x64-musl'],
      [{ platform: 'linux', arch: 'arm64', libc: 'gnu' }, '@stax-xml/native-linux-arm64-gnu'],
      [{ platform: 'linux', arch: 'arm64', libc: 'musl' }, '@stax-xml/native-linux-arm64-musl'],
      [{ platform: 'linux', arch: 'x64' }, '@stax-xml/native-linux-x64-gnu'],
      [{ platform: 'darwin', arch: 'x64' }, '@stax-xml/native-darwin-x64'],
      [{ platform: 'darwin', arch: 'arm64' }, '@stax-xml/native-darwin-arm64'],
      [{ platform: 'win32', arch: 'x64' }, '@stax-xml/native-win32-x64-msvc'],
      [{ platform: 'win32', arch: 'arm64' }, '@stax-xml/native-win32-arm64-msvc'],
      [{ platform: 'freebsd', arch: 'x64' }, undefined]
    ];

    for (const [platform, packageName] of cases) {
      expect(getStaxXmlNativePackageName(platform)).toBe(packageName);
    }
  });

  it('detects runtime platform from process-like objects', () => {
    expect(detectRuntimePlatform({
      platform: 'linux',
      arch: 'x64',
      report: { getReport: () => ({ header: { glibcVersionRuntime: '2.39' } }) }
    })).toEqual({ platform: 'linux', arch: 'x64', libc: 'gnu' });

    expect(detectRuntimePlatform({
      platform: 'linux',
      arch: 'arm64',
      report: { getReport: () => ({ header: {} }) }
    })).toEqual({ platform: 'linux', arch: 'arm64', libc: 'musl' });

    expect(detectRuntimePlatform({ platform: 'darwin', arch: 'arm64' }))
      .toEqual({ platform: 'darwin', arch: 'arm64', libc: undefined });
    expect(detectRuntimePlatform({ platform: undefined, arch: undefined }))
      .toEqual({ platform: 'browser', arch: 'unknown', libc: undefined });
    expect(detectRuntimePlatform().platform).toBe(process.platform);
  });

  it('loads the native package before wasm when native is available', async () => {
    const calls: string[] = [];
    const backend = await resolveStaxXmlRuntimeBackend({
      platform: { platform: 'win32', arch: 'x64' },
      importPackage: async (packageName) => {
        calls.push(packageName);
        return { packageName };
      }
    });

    expect(calls).toEqual(['@stax-xml/native-win32-x64-msvc']);
    expect(backend).toMatchObject({
      kind: 'native',
      packageName: '@stax-xml/native-win32-x64-msvc',
      module: { packageName: '@stax-xml/native-win32-x64-msvc' },
      errors: []
    });
  });

  it('uses detected native platform when no platform override is provided', async () => {
    const detected = detectRuntimePlatform();
    const expectedPackage = getStaxXmlNativePackageName(detected);
    if (!expectedPackage) {
      await expect(resolveStaxXmlRuntimeBackend({
        importPackage: async (packageName) => ({ packageName }),
      })).rejects.toThrow(/Expected package: no native package/);
      return;
    }
    const calls: string[] = [];
    const backend = await resolveStaxXmlRuntimeBackend({
      importPackage: async (packageName) => {
        calls.push(packageName);
        return { packageName };
      }
    });

    expect(calls).toEqual([expectedPackage]);
    expect(backend.packageName).toBe(expectedPackage);
  });

  it('uses only explicit wasm fallback and never falls through to JavaScript', async () => {
    await expect(resolveStaxXmlRuntimeBackend({
      platform: { platform: 'darwin', arch: 'arm64' },
      importPackage: async (packageName) => {
        throw new Error(`missing ${packageName}`);
      }
    })).rejects.toThrow(/fallbackBackend: "wasm"/);

    const wasmCalls: string[] = [];
    const wasmBackend = await resolveStaxXmlRuntimeBackend({
      platform: { platform: 'darwin', arch: 'arm64' },
      fallbackBackend: 'wasm',
      importPackage: async (packageName) => {
        wasmCalls.push(packageName);
        if (packageName === WASM_PACKAGE_NAME) {
          return { wasm: true };
        }
        throw new Error(`missing ${packageName}`);
      }
    });

    expect(wasmCalls).toEqual(['@stax-xml/native-darwin-arm64', WASM_PACKAGE_NAME]);
    expect(wasmBackend.kind).toBe('wasm');
    expect(wasmBackend.errors).toHaveLength(1);

    await expect(resolveStaxXmlRuntimeBackend({
      platform: { platform: 'freebsd', arch: 'x64' },
      importPackage: async (packageName) => {
        throw new Error(`missing ${packageName}`);
      }
    })).rejects.toThrow(/no native package for freebsd\/x64/);
  });

  it('can resolve the explicit wasm backend without linking the wasm package workspace', async () => {
    const backend = await resolveStaxXmlRuntimeBackend({
      backend: 'wasm',
      platform: { platform: 'freebsd', arch: 'x64' },
      importPackage: async (packageName) => {
        if (packageName === WASM_PACKAGE_NAME) {
          return { wasm: true };
        }
        throw new Error(`missing ${packageName}`);
      }
    });

    expect(backend.kind).toBe('wasm');
    expect(backend.packageName).toBe(WASM_PACKAGE_NAME);
    expect(backend.errors).toEqual([]);
  });
});

function readPackage(relativePath: string): Record<string, any> {
  return JSON.parse(readFileSync(resolve(__dirname, relativePath), 'utf8'));
}

function readText(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}
