import { createWriteStream, createReadStream, existsSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pipeline, Readable } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

export interface LargeFileConfig {
  sizeGB: number;
  tempDir?: string;
  filename?: string;
}

// 1GB XML 파일 생성
export async function generateLargeXML(config: LargeFileConfig): Promise<string> {
  const { sizeGB, tempDir = tmpdir(), filename = `large-${sizeGB}gb.xml` } = config;
  const filePath = join(tempDir, filename);

  // 이미 존재하고 크기가 맞으면 재사용
  if (existsSync(filePath)) {
    const stats = statSync(filePath);
    const expectedSize = sizeGB * 1024 * 1024 * 1024;
    if (Math.abs(stats.size - expectedSize) < expectedSize * 0.01) { // 1% 오차 허용
      console.log(`✅ Using existing file: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return filePath;
    }
  }

  console.log(`🔄 Generating ${sizeGB}GB XML file: ${filePath}`);

  const targetSize = sizeGB * 1024 * 1024 * 1024;
  const writeStream = createWriteStream(filePath);

  // 기본 XML 구조 및 반복 패턴
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
  const xmlFooter = '</root>\n';

  // 대략 1KB 크기의 반복 엘리먼트
  const repeatingElement = `  <book id="book-{id}">
    <title>Sample Book Title Number {id} - Lorem ipsum dolor sit amet, consectetur adipiscing elit</title>
    <author>Author Name {id}</author>
    <isbn>978-{isbn}</isbn>
    <publisher>Sample Publisher {id}</publisher>
    <publishDate>202{year}-{month:02d}-{day:02d}</publishDate>
    <description>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
      Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
      Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
    </description>
    <chapters>
      <chapter number="1">Introduction Chapter for Book {id}</chapter>
      <chapter number="2">Main Content Chapter for Book {id}</chapter>
      <chapter number="3">Conclusion Chapter for Book {id}</chapter>
    </chapters>
  </book>
`;

  const elementSize = Buffer.byteLength(repeatingElement.replace(/\{[^}]+\}/g, '0000000000'), 'utf8');
  const headerSize = Buffer.byteLength(xmlHeader, 'utf8');
  const footerSize = Buffer.byteLength(xmlFooter, 'utf8');
  const contentSize = targetSize - headerSize - footerSize;
  const numElements = Math.floor(contentSize / elementSize);

  console.log(`📊 Target size: ${targetSize.toLocaleString()} bytes`);
  console.log(`📊 Element size: ${elementSize} bytes`);
  console.log(`📊 Number of elements: ${numElements.toLocaleString()}`);

  const stream = new Readable({
    read() {
      // Will be pushed by generator
    }
  });

  let currentId = 0;
  let written = 0;

  // 헤더 작성
  stream.push(xmlHeader);
  written += headerSize;

  // 엘리먼트 생성 및 작성
  const writeElements = () => {
    const batchSize = 1000; // 한 번에 1000개씩 처리

    for (let i = 0; i < batchSize && currentId < numElements; i++) {
      const id = currentId++;
      const isbn = `${Math.floor(Math.random() * 900000000) + 100000000}`;
      const year = Math.floor(Math.random() * 5) + 0; // 2020-2024
      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;

      const element = repeatingElement
        .replace(/\{id\}/g, id.toString())
        .replace(/\{isbn\}/g, isbn)
        .replace(/\{year\}/g, year.toString())
        .replace(/\{month:02d\}/g, month.toString().padStart(2, '0'))
        .replace(/\{day:02d\}/g, day.toString().padStart(2, '0'));

      stream.push(element);
      written += Buffer.byteLength(element, 'utf8');
    }

    if (currentId >= numElements) {
      // 푸터 작성하고 종료
      stream.push(xmlFooter);
      written += footerSize;
      stream.push(null); // End stream

      console.log(`✅ Generated ${(written / 1024 / 1024).toFixed(2)} MB XML file with ${currentId.toLocaleString()} elements`);
    } else {
      // 다음 배치를 비동기적으로 스케줄링
      setImmediate(writeElements);
    }
  };

  // 비동기적으로 엘리먼트 생성 시작
  setImmediate(writeElements);

  await pipelineAsync(stream, writeStream);

  return filePath;
}

// 1GB JSON 파일 생성 (테스트용)
export async function generateLargeJSON(config: LargeFileConfig): Promise<string> {
  const { sizeGB, tempDir = tmpdir(), filename = `large-${sizeGB}gb.json` } = config;
  const filePath = join(tempDir, filename);

  // 이미 존재하고 크기가 맞으면 재사용
  if (existsSync(filePath)) {
    const stats = statSync(filePath);
    const expectedSize = sizeGB * 1024 * 1024 * 1024;
    if (Math.abs(stats.size - expectedSize) < expectedSize * 0.01) { // 1% 오차 허용
      console.log(`✅ Using existing file: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return filePath;
    }
  }

  console.log(`🔄 Generating ${sizeGB}GB JSON file: ${filePath}`);

  const targetSize = sizeGB * 1024 * 1024 * 1024;
  const writeStream = createWriteStream(filePath);

  const jsonHeader = '{\n  "books": [\n';
  const jsonFooter = '\n  ]\n}\n';

  // 대략 1KB 크기의 반복 객체
  const repeatingObject = `    {
      "id": {id},
      "title": "Sample Book Title Number {id} - Lorem ipsum dolor sit amet, consectetur adipiscing elit",
      "author": "Author Name {id}",
      "isbn": "978-{isbn}",
      "publisher": "Sample Publisher {id}",
      "publishDate": "202{year}-{month:02d}-{day:02d}",
      "description": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      "chapters": [
        {"number": 1, "title": "Introduction Chapter for Book {id}"},
        {"number": 2, "title": "Main Content Chapter for Book {id}"},
        {"number": 3, "title": "Conclusion Chapter for Book {id}"}
      ]
    }`;

  const elementSize = Buffer.byteLength(repeatingObject.replace(/\{[^}]+\}/g, '0000000000'), 'utf8');
  const headerSize = Buffer.byteLength(jsonHeader, 'utf8');
  const footerSize = Buffer.byteLength(jsonFooter, 'utf8');
  const contentSize = targetSize - headerSize - footerSize;
  const numElements = Math.floor(contentSize / elementSize);

  console.log(`📊 Target size: ${targetSize.toLocaleString()} bytes`);
  console.log(`📊 Element size: ${elementSize} bytes`);
  console.log(`📊 Number of elements: ${numElements.toLocaleString()}`);

  const stream = new Readable({
    read() {
      // Will be pushed by generator
    }
  });

  let currentId = 0;
  let written = 0;

  // 헤더 작성
  stream.push(jsonHeader);
  written += headerSize;

  // 객체 생성 및 작성
  const writeObjects = () => {
    const batchSize = 1000; // 한 번에 1000개씩 처리

    for (let i = 0; i < batchSize && currentId < numElements; i++) {
      const id = currentId++;
      const isbn = `${Math.floor(Math.random() * 900000000) + 100000000}`;
      const year = Math.floor(Math.random() * 5) + 0; // 2020-2024
      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;

      const isLast = currentId >= numElements;
      const separator = isLast ? '' : ',';

      const element = repeatingObject
        .replace(/\{id\}/g, id.toString())
        .replace(/\{isbn\}/g, isbn)
        .replace(/\{year\}/g, year.toString())
        .replace(/\{month:02d\}/g, month.toString().padStart(2, '0'))
        .replace(/\{day:02d\}/g, day.toString().padStart(2, '0')) + separator + '\n';

      stream.push(element);
      written += Buffer.byteLength(element, 'utf8');
    }

    if (currentId >= numElements) {
      // 푸터 작성하고 종료
      stream.push(jsonFooter);
      written += footerSize;
      stream.push(null); // End stream

      console.log(`✅ Generated ${(written / 1024 / 1024).toFixed(2)} MB JSON file with ${currentId.toLocaleString()} objects`);
    } else {
      // 다음 배치를 비동기적으로 스케줄링
      setImmediate(writeObjects);
    }
  };

  // 비동기적으로 객체 생성 시작
  setImmediate(writeObjects);

  await pipelineAsync(stream, writeStream);

  return filePath;
}

// 임시 파일 정리
export async function cleanupTempFiles(filePaths: string[]): Promise<void> {
  const fs = await import('fs/promises');

  for (const filePath of filePaths) {
    try {
      if (existsSync(filePath)) {
        await fs.unlink(filePath);
        console.log(`🗑️ Cleaned up: ${filePath}`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup ${filePath}:`, error);
    }
  }
}