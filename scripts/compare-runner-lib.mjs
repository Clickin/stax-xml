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
  const branch = await runOptionalCommand('git', ['-C', repoRoot, 'symbolic-ref', '--short', '-q', 'HEAD']);

  return {
    head,
    branch: branch || null,
  };
}

export async function getGitStatusSummary(repoRoot) {
  const output = await runSmallCommand('git', ['-C', repoRoot, 'status', '--porcelain']);
  const entries = output
    ? output.split('\n').filter(Boolean)
    : [];

  return {
    dirty: entries.length > 0,
    entries,
  };
}

export async function getWorktreeList(repoRoot) {
  const output = await runSmallCommand('git', ['-C', repoRoot, 'worktree', 'list', '--porcelain']);
  return parseWorktreeList(output);
}

export function resolveBuiltDistEntrypoint(repoRoot) {
  const candidates = [
    path.join(repoRoot, 'packages/stax-xml/dist/index.js'),
    path.join(repoRoot, 'packages/stax-xml/dist/index.mjs'),
  ];

  const match = candidates.find((candidate) => existsOnDisk(candidate));
  if (!match) {
    throw new Error(
      `Missing built dist entrypoint. Expected one of: ${candidates.join(', ')}`
    );
  }

  return match;
}

export async function runLoggedCommand({ command, args, cwd, env, logPath, timeoutMs }) {
  await ensureDir(path.dirname(logPath));

  const startedAt = new Date().toISOString();
  const logStream = createWriteStream(logPath, { flags: 'w' });
  logStream.write(`# cwd: ${cwd}\n`);
  logStream.write(`# command: ${[command, ...args].join(' ')}\n`);
  logStream.write(`# startedAt: ${startedAt}\n\n`);
  if (timeoutMs) {
    logStream.write(`# timeoutMs: ${timeoutMs}\n\n`);
  }

  const start = process.hrtime.bigint();

  const result = await new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let killTimer;
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      logStream.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      logStream.write(chunk);
    });
    if (timeoutMs) {
      killTimer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGKILL');
          }
        }, 5_000).unref();
      }, timeoutMs);
    }
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (killTimer) {
        clearTimeout(killTimer);
      }
      resolve({ code, signal, stdout, stderr, timedOut });
    });
  });

  const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  logStream.write(`\n# finishedAt: ${new Date().toISOString()}\n`);
  logStream.write(`# durationMs: ${durationMs.toFixed(3)}\n`);
  logStream.write(`# exitCode: ${result.code ?? 'null'}\n`);
  logStream.write(`# timedOut: ${result.timedOut ? 'true' : 'false'}\n`);
  if (result.signal) {
    logStream.write(`# signal: ${result.signal}\n`);
  }
  await new Promise((resolve) => logStream.end(resolve));

  return {
    startedAt,
    durationMs,
    exitCode: result.code,
    signal: result.signal,
    timedOut: result.timedOut,
    stdout: result.stdout,
    stderr: result.stderr,
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

async function runOptionalCommand(command, args) {
  try {
    return await runSmallCommand(command, args);
  } catch {
    return '';
  }
}

function parseWorktreeList(output) {
  if (!output) {
    return [];
  }

  const entries = [];
  let current = null;

  for (const line of output.split('\n')) {
    if (!line) {
      if (current) {
        entries.push(current);
        current = null;
      }
      continue;
    }

    const [key, ...rest] = line.split(' ');
    const value = rest.join(' ');
    if (key === 'worktree') {
      if (current) {
        entries.push(current);
      }
      current = { worktree: value };
      continue;
    }

    if (!current) {
      continue;
    }

    if (key === 'HEAD') {
      current.head = value;
    } else if (key === 'branch') {
      current.branch = value.replace('refs/heads/', '');
    } else if (key === 'detached') {
      current.detached = true;
    } else if (key === 'locked') {
      current.locked = value || true;
    } else if (key === 'prunable') {
      current.prunable = value || true;
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

function existsOnDisk(filePath) {
  try {
    return process.getBuiltinModule('node:fs').existsSync(filePath);
  } catch {
    return false;
  }
}
