#!/usr/bin/env tsx

/**
 * Add Astro frontmatter to TypeDoc generated markdown files
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const API_DIRS = [
  join(__dirname, '../src/content/docs/api/converter'),
  join(__dirname, '../src/content/docs/api/main'),
];

async function addFrontmatter(filePath: string): Promise<void> {
  const content = await readFile(filePath, 'utf-8');

  // Check if frontmatter already exists
  if (content.startsWith('---')) {
    console.log(`Skipping ${filePath} - already has frontmatter`);
    return;
  }

  // Extract title from first heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : basename(filePath, '.md');

  // Create frontmatter
  const frontmatter = `---
title: ${title}
description: API reference for ${title}
---

`;

  // Write file with frontmatter
  await writeFile(filePath, frontmatter + content, 'utf-8');
  console.log(`Added frontmatter to ${filePath}`);
}

async function processDirectory(dirPath: string): Promise<void> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await processDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        await addFrontmatter(fullPath);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`Directory not found: ${dirPath}`);
    } else {
      throw error;
    }
  }
}

async function main(): Promise<void> {
  console.log('Adding frontmatter to TypeDoc files...');

  for (const dir of API_DIRS) {
    console.log(`\nProcessing ${dir}...`);
    await processDirectory(dir);
  }

  console.log('\nDone!');
}

main().catch(console.error);
