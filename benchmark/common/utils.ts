import { readFileSync } from 'fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Asset file paths
export const ASSET_PATHS = {
  // XML files
  books: join(__dirname, '../assets/books.xml'),        // 4KB
  complex: join(__dirname, '../assets/complex.xml'),    // 2KB
  sample: join(__dirname, '../assets/sample.xml'),      // 1.5KB
  midsize: join(__dirname, '../assets/midsize.xml'),    // 13MB
  large: join(__dirname, '../assets/large.xml'),        // 98MB

  // JSON files
  test: join(__dirname, '../assets/test.json'),
  testOrdered: join(__dirname, '../assets/test_ordered.json'),
  big: join(__dirname, '../assets/big.json'),           // 1MB
} as const;

// File loading utilities
export function loadXmlFile(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

export function loadJsonFile(filePath: string): any {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

// Note: mitata's run() function doesn't support min_samples/max_samples options
// Use run() without arguments for default behavior

// Memory tracking utility
export interface MemoryUsage {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

export function getMemoryUsage(): MemoryUsage {
  return process.memoryUsage();
}

export function formatMemoryUsage(usage: MemoryUsage): string {
  const formatBytes = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  return `RSS: ${formatBytes(usage.rss)}, Heap Used: ${formatBytes(usage.heapUsed)}, Heap Total: ${formatBytes(usage.heapTotal)}`;
}

// Performance timing utility
export function measurePerformance<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return { result, duration };
}