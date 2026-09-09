/**
 * Generate large XML fixtures (10GB, 20GB, 30GB) with database row-like structure.
 * Streams output to avoid OOM - writes in chunks.
 */
import { createWriteStream, WriteStream } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const GIB = 1024 * 1024 * 1024;
const MIB = 1024 * 1024;
const KIB = 1024;

const COLUMNS = [
  { name: 'id', type: 'int' },
  { name: 'account_id', type: 'int' },
  { name: 'email', type: 'string', length: 64 },
  { name: 'first_name', type: 'string', length: 32 },
  { name: 'last_name', type: 'string', length: 32 },
  { name: 'phone', type: 'string', length: 24 },
  { name: 'address', type: 'string', length: 128 },
  { name: 'city', type: 'string', length: 48 },
  { name: 'state', type: 'string', length: 2 },
  { name: 'zipcode', type: 'string', length: 10 },
  { name: 'country', type: 'string', length: 2 },
  { name: 'created_at', type: 'date' },
  { name: 'updated_at', type: 'date' },
  { name: 'balance', type: 'float' },
  { name: 'is_active', type: 'bool' },
  { name: 'tier', type: 'int' },
  { name: 'notes', type: 'string', length: 256 },
];

const ROW_OPEN = '<row>';
const ROW_CLOSE = '</row>';

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const COUNTRIES = ['US', 'CA', 'MX', 'GB', 'DE', 'FR', 'JP', 'AU', 'BR', 'IN'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate() {
  const year = randomInt(2010, 2024);
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function randomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRow(rowId) {
  const parts = [ROW_OPEN];
  
  for (const col of COLUMNS) {
    let value;
    switch (col.type) {
      case 'int':
        value = String(rowId + randomInt(0, 1000000));
        break;
      case 'string':
        value = randomString(col.length ?? 32);
        break;
      case 'date':
        value = randomDate();
        break;
      case 'float':
        value = (Math.random() * 100000).toFixed(2);
        break;
      case 'bool':
        value = Math.random() > 0.5 ? 'true' : 'false';
        break;
    }
    parts.push(`<${col.name}>${value}</${col.name}>`);
  }
  
  parts.push(ROW_CLOSE);
  return parts.join('');
}

function estimateRowSize() {
  return Buffer.byteLength(generateRow(1), 'utf8');
}

async function generateLargeXml(outputPath, targetBytes, chunkRows = 10000) {
  const writer = createWriteStream(outputPath, { highWaterMark: 64 * MIB });
  
  writer.write('<?xml version="1.0" encoding="UTF-8"?>\n');
  writer.write('<database>\n');
  
  let totalBytes = Buffer.byteLength('<?xml version="1.0" encoding="UTF-8"?>\n<database>\n', 'utf8');
  let rowCount = 0;
  const rowBuffer = [];
  
  const sampleRow = generateRow(1);
  const avgRowBytes = Buffer.byteLength(sampleRow, 'utf8');
  const estimatedRows = Math.ceil((targetBytes - totalBytes - Buffer.byteLength('</database>\n', 'utf8')) / avgRowBytes);
  
  console.log(`Target: ${(targetBytes / GIB).toFixed(2)} GiB`);
  console.log(`Estimated rows: ${estimatedRows.toLocaleString()}`);
  console.log(`Avg row size: ~${(avgRowBytes / KIB).toFixed(1)} KiB`);
  
  for (let i = 1; i <= estimatedRows; i++) {
    rowBuffer.push(generateRow(i));
    rowCount++;
    
    if (rowBuffer.length >= chunkRows) {
      const chunk = rowBuffer.join('\n') + '\n';
      await new Promise((resolve, reject) => {
        writer.write(chunk, (err) => err ? reject(err) : resolve());
      });
      totalBytes += Buffer.byteLength(chunk, 'utf8');
      rowBuffer.length = 0;
      
      if (rowCount % 100000 === 0) {
        const gb = totalBytes / GIB;
        console.log(`  Generated ${rowCount.toLocaleString()} rows (${gb.toFixed(2)} GiB)`);
      }
    }
  }
  
  if (rowBuffer.length > 0) {
    const chunk = rowBuffer.join('\n') + '\n';
    await new Promise((resolve, reject) => {
      writer.write(chunk, (err) => err ? reject(err) : resolve());
    });
    totalBytes += Buffer.byteLength(chunk, 'utf8');
  }
  
  writer.write('</database>\n');
  totalBytes += Buffer.byteLength('</database>\n', 'utf8');
  
  await new Promise((resolve, reject) => {
    writer.end((err) => err ? reject(err) : resolve());
  });
  
  console.log(`Done: ${rowCount.toLocaleString()} rows, ${(totalBytes / GIB).toFixed(2)} GiB`);
  return { rows: rowCount, bytes: totalBytes };
}

async function main() {
  const args = process.argv.slice(2);
  const sizeArg = args.find(a => a.startsWith('--size-gib='));
  const outputArg = args.find(a => a.startsWith('--output='));
  const listArg = args.includes('--list-sizes');
  
  if (listArg) {
    console.log('Available sizes:');
    console.log('  10  - 10 GiB');
    console.log('  20  - 20 GiB');
    console.log('  30  - 30 GiB');
    return;
  }
  
  const sizeGib = sizeArg ? parseFloat(sizeArg.split('=')[1]) : 10;
  const outputDir = outputArg ? outputArg.split('=')[1] : join(__dirname, 'assets', 'large');
  const outputFile = join(outputDir, `database-${sizeGib}gib.xml`);
  
  console.log(`Generating ${sizeGib} GiB XML fixture...`);
  console.log(`Output: ${outputFile}`);
  
  const startTime = Date.now();
  const { rows, bytes } = await generateLargeXml(outputFile, sizeGib * GIB);
  const elapsed = (Date.now() - startTime) / 1000;
  
  console.log(`\nCompleted in ${elapsed.toFixed(1)}s`);
  console.log(`Rows: ${rows.toLocaleString()}`);
  console.log(`Size: ${(bytes / GIB).toFixed(2)} GiB`);
  console.log(`Throughput: ${(bytes / 1024 / 1024 / elapsed).toFixed(1)} MiB/s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});