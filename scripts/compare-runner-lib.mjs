import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

export function usage(message) {
  if (message) {
    console.error(message);
    console.error('');
  }
}

export function getOutputRoot(label) {
  return path.join('/tmp/stax-compare', label);
}

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
  return dirPath;
}

export async function getGitMetadata(repoRoot) {
  const head = await runSmallCommand('git', ['-C', repoRoot, 'rev-parse', 'HEAD']);
  const branch = await runSmallCommand('git', ['-C', repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD']);

  return {
    head,
    branch,
  };
}

export async function runLoggedCommand({ command, args, cwd, env, logPath }) {
  await ensureDir(path.dirname(logPath));

  const startedAt = new Date().toISOString();
  const logStream = createWriteStream(logPath, { flags: 'w' });
  logStream.write(`# cwd: ${cwd}\n`);
  logStream.write(`# command: ${[command, ...args].join(' ')}\n`);
  logStream.write(`# startedAt: ${startedAt}\n\n`);

  const start = process.hrtime.bigint();

  const result = await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      logStream.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      logStream.write(chunk);
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      resolve({ code, signal });
    });
  });

  const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  logStream.write(`\n# finishedAt: ${new Date().toISOString()}\n`);
  logStream.write(`# durationMs: ${durationMs.toFixed(3)}\n`);
  logStream.write(`# exitCode: ${result.code ?? 'null'}\n`);
  if (result.signal) {
    logStream.write(`# signal: ${result.signal}\n`);
  }
  await new Promise((resolve) => logStream.end(resolve));

  return {
    startedAt,
    durationMs,
    exitCode: result.code,
    signal: result.signal,
    logPath,
  };
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function listCpuProfiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.cpuprofile'))
    .map((entry) => path.join(dirPath, entry.name))
    .sort();
}

async function runSmallCommand(command, args) {
  const output = await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'inherit'],
    });

    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
  });

  return output;
}
