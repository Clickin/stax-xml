export function createLargeXMLStream(config) {
  const { sizeGB, chunkSize = 1024 * 64, verbose = true } = config;

  const targetSize = sizeGB * 1024 * 1024 * 1024;
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
  const xmlFooter = '</root>\n';

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

  return new ReadableStream({
    start(controller) {
      let currentId = 0;
      let written = 0;
      const encoder = new TextEncoder();

      controller.enqueue(encoder.encode(xmlHeader));
      written += headerSize;

      const generateChunk = () => {
        let buffer = '';
        let bufferSize = 0;

        while (bufferSize < chunkSize && currentId < numElements) {
          const id = currentId++;
          const isbn = `${Math.floor(Math.random() * 900000000) + 100000000}`;
          const year = Math.floor(Math.random() * 5);
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
          controller.enqueue(encoder.encode(xmlFooter));
          written += footerSize;
          controller.close();
          if (verbose) {
            console.log(`✅ Generated ${(written / 1024 / 1024).toFixed(2)} MB XML stream with ${currentId.toLocaleString()} elements`);
          }
        } else {
          setImmediate(generateChunk);
        }
      };

      setImmediate(generateChunk);
    }
  });
}
