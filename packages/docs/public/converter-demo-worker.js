import { x } from './stax-xml-converter.js';

function createXmlStream(xmlInput) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(xmlInput));
      controller.close();
    }
  });
}

self.onmessage = async (event) => {
  const { id, schemaInput, xmlInput, file, parseOptions } = event.data ?? {};

  try {
    const schemaFunction = new Function('x', `return ${schemaInput}`);
    const schema = schemaFunction(x);

    const xmlSize = file ? file.size : new Blob([xmlInput]).size;
    const input = file ? file.stream() : createXmlStream(xmlInput);
    const result = await schema.parse(input, parseOptions);

    self.postMessage({
      id,
      ok: true,
      result,
      xmlSize
    });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  }
};
