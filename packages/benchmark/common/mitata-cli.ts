import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { run } from 'mitata';

export type MitataCliFormat = 'mitata' | 'json' | 'markdown' | 'quiet';

export interface ParsedMitataCliArgs {
  format: MitataCliFormat;
  outFile?: string;
  filter?: RegExp;
  debug: boolean;
  samples: boolean;
}

export function parseMitataCliArgs(argv: string[] = process.argv.slice(2)): ParsedMitataCliArgs {
  let format: MitataCliFormat = 'mitata';
  let outFile: string | undefined;
  let filter: RegExp | undefined;
  let debug = true;
  let samples = true;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === '--json') {
      format = 'json';
      continue;
    }
    if (arg === '--markdown') {
      format = 'markdown';
      continue;
    }
    if (arg === '--quiet') {
      format = 'quiet';
      continue;
    }
    if (arg === '--mitata') {
      format = 'mitata';
      continue;
    }
    if (arg === '--no-debug') {
      debug = false;
      continue;
    }
    if (arg === '--no-samples') {
      samples = false;
      continue;
    }

    if (arg === '--format') {
      const value = argv[index + 1] as MitataCliFormat | undefined;
      if (value) {
        format = value;
        index++;
      }
      continue;
    }
    if (arg.startsWith('--format=')) {
      format = arg.slice('--format='.length) as MitataCliFormat;
      continue;
    }

    if (arg === '--out') {
      const value = argv[index + 1];
      if (value) {
        outFile = value;
        index++;
      }
      continue;
    }
    if (arg.startsWith('--out=')) {
      outFile = arg.slice('--out='.length);
      continue;
    }

    if (arg === '--filter') {
      const value = argv[index + 1];
      if (value) {
        filter = new RegExp(value);
        index++;
      }
      continue;
    }
    if (arg.startsWith('--filter=')) {
      filter = new RegExp(arg.slice('--filter='.length));
    }
  }

  return { format, outFile, filter, debug, samples };
}

export function shouldPrintHumanReadableBanner(cli: ParsedMitataCliArgs): boolean {
  return cli.format === 'mitata' || cli.format === 'markdown';
}

function createFormatOption(cli: ParsedMitataCliArgs): string | Record<string, object> {
  switch (cli.format) {
    case 'json':
      return { json: { debug: cli.debug, samples: cli.samples } };
    case 'markdown':
      return 'markdown';
    case 'quiet':
      return 'quiet';
    case 'mitata':
    default:
      return 'mitata';
  }
}

export async function runMitataWithCli(cli: ParsedMitataCliArgs) {
  const captured: string[] = [];
  const result = await run({
    format: createFormatOption(cli),
    ...(cli.outFile ? { print: (line: string) => captured.push(line) } : {}),
    ...(cli.filter ? { filter: cli.filter } : {}),
    throw: true,
  });

  if (cli.outFile) {
    const resolved = resolve(process.cwd(), cli.outFile);
    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, `${captured.join('\n')}\n`, 'utf8');
    console.log(`Saved ${cli.format} benchmark output to ${resolved}`);
  }

  return result;
}
