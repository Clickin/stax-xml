import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ASSET_PATHS = {
  books: join(__dirname, '../assets/books.xml'),
  complex: join(__dirname, '../assets/complex.xml'),
  sample: join(__dirname, '../assets/sample.xml'),
  midsize: join(__dirname, '../assets/midsize.xml'),
  large: join(__dirname, '../assets/large.xml'),
  test: join(__dirname, '../assets/test.json'),
  testOrdered: join(__dirname, '../assets/test_ordered.json'),
  big: join(__dirname, '../assets/big.json'),
};

export function loadXmlFile(filePath) {
  return readFileSync(filePath, 'utf8');
}

export function loadJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}
