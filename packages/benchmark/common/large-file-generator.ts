export interface LargeStreamConfig {
  sizeGB: number;
  chunkSize?: number;
  verbose?: boolean;
}

/**
 * Creates a ReadableStream that generates XML data on-the-fly
 * without writing to disk. Memory-efficient and safe for concurrent tests.
 */
export function createLargeXMLStream(config: LargeStreamConfig): ReadableStream<Uint8Array> {
  const { sizeGB, chunkSize = 1024 * 64, verbose = true } = config; // 64KB default chunk size

  const targetSize = sizeGB * 1024 * 1024 * 1024;
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
  const xmlFooter = '</root>\n';

  // Template for repeating element (~1KB per element)
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

  if (verbose) {
    console.log(`📊 Creating ${sizeGB}GB XML stream`);
    console.log(`📊 Element size: ${elementSize} bytes`);
    console.log(`📊 Number of elements: ${numElements.toLocaleString()}`);
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let currentId = 0;
      let written = 0;
      const encoder = new TextEncoder();

      // Enqueue header
      controller.enqueue(encoder.encode(xmlHeader));
      written += headerSize;

      // Function to generate and enqueue elements
      const generateChunk = () => {
        let buffer = '';
        let bufferSize = 0;

        // Generate elements until we reach chunk size or target
        while (bufferSize < chunkSize && currentId < numElements) {
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

          buffer += element;
          bufferSize += Buffer.byteLength(element, 'utf8');
        }

        if (buffer.length > 0) {
          controller.enqueue(encoder.encode(buffer));
          written += bufferSize;
        }

        if (currentId >= numElements) {
          // Enqueue footer and close
          controller.enqueue(encoder.encode(xmlFooter));
          written += footerSize;
          controller.close();
          if (verbose) {
            console.log(`✅ Generated ${(written / 1024 / 1024).toFixed(2)} MB XML stream with ${currentId.toLocaleString()} elements`);
          }
        } else {
          // Schedule next chunk asynchronously
          setImmediate(generateChunk);
        }
      };

      // Start generating
      setImmediate(generateChunk);
    }
  });
}

/**
 * Creates a ReadableStream that generates JSON data on-the-fly
 * without writing to disk. Memory-efficient and safe for concurrent tests.
 */
export function createLargeJSONStream(config: LargeStreamConfig): ReadableStream<Uint8Array> {
  const { sizeGB, chunkSize = 1024 * 64, verbose = true } = config; // 64KB default chunk size

  const targetSize = sizeGB * 1024 * 1024 * 1024;
  const jsonHeader = '{\n  "books": [\n';
  const jsonFooter = '\n  ]\n}\n';

  // Template for repeating object (~1KB per object)
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

  if (verbose) {
    console.log(`📊 Creating ${sizeGB}GB JSON stream`);
    console.log(`📊 Element size: ${elementSize} bytes`);
    console.log(`📊 Number of elements: ${numElements.toLocaleString()}`);
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let currentId = 0;
      let written = 0;
      const encoder = new TextEncoder();

      // Enqueue header
      controller.enqueue(encoder.encode(jsonHeader));
      written += headerSize;

      // Function to generate and enqueue objects
      const generateChunk = () => {
        let buffer = '';
        let bufferSize = 0;

        // Generate objects until we reach chunk size or target
        while (bufferSize < chunkSize && currentId < numElements) {
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

          buffer += element;
          bufferSize += Buffer.byteLength(element, 'utf8');
        }

        if (buffer.length > 0) {
          controller.enqueue(encoder.encode(buffer));
          written += bufferSize;
        }

        if (currentId >= numElements) {
          // Enqueue footer and close
          controller.enqueue(encoder.encode(jsonFooter));
          written += footerSize;
          controller.close();
          if (verbose) {
            console.log(`✅ Generated ${(written / 1024 / 1024).toFixed(2)} MB JSON stream with ${currentId.toLocaleString()} objects`);
          }
        } else {
          // Schedule next chunk asynchronously
          setImmediate(generateChunk);
        }
      };

      // Start generating
      setImmediate(generateChunk);
    }
  });
}
