import { x } from 'stax-xml/converter';

const WORKER_STRING_PARSE_THRESHOLD = 25 * 1024 * 1024;

function createXmlStream(xmlInput: string) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(xmlInput));
      controller.close();
    }
  });
}

self.onmessage = async (event) => {
  const { id, schemaInput, xmlInput, file, parseOptions, requestedMode } = event.data ?? {};

  try {
    const workerStart = performance.now();
    const schemaStart = performance.now();
    const schemaFunction = new Function('x', `return ${schemaInput}`);
    const schema = schemaFunction(x);
    const schemaCompileMs = performance.now() - schemaStart;

    const xmlSize = file ? file.size : new Blob([xmlInput]).size;
    let result;
    let parseMode;
    const inputPrepStart = performance.now();

    if (requestedMode === 'sync') {
      const text = file ? await file.text() : xmlInput;
      parseMode = file ? 'file-text-sync' : 'inline-text-sync';
      const inputPrepMs = performance.now() - inputPrepStart;
      const parseStart = performance.now();
      result = schema.parseSync(text, parseOptions);
      const parseMs = performance.now() - parseStart;
      self.postMessage({
        id,
        ok: true,
        result,
        xmlSize,
        timings: {
          parseMode,
          requestedMode,
          schemaCompileMs,
          inputPrepMs,
          parseMs,
          workerTotalMs: performance.now() - workerStart
        }
      });
      return;
    }

    if (requestedMode === 'async') {
      parseMode = file ? 'file-stream-async' : 'inline-stream-async';
      const input = file ? file.stream() : createXmlStream(xmlInput);
      const inputPrepMs = performance.now() - inputPrepStart;
      const parseStart = performance.now();
      result = await schema.parse(input, parseOptions);
      const parseMs = performance.now() - parseStart;
      self.postMessage({
        id,
        ok: true,
        result,
        xmlSize,
        timings: {
          parseMode,
          requestedMode,
          schemaCompileMs,
          inputPrepMs,
          parseMs,
          workerTotalMs: performance.now() - workerStart
        }
      });
      return;
    }

    if (file && file.size <= WORKER_STRING_PARSE_THRESHOLD) {
      const text = await file.text();
      parseMode = 'file-text-sync';
      const inputPrepMs = performance.now() - inputPrepStart;
      const parseStart = performance.now();
      result = schema.parseSync(text, parseOptions);
      const parseMs = performance.now() - parseStart;
      self.postMessage({
        id,
        ok: true,
        result,
        xmlSize,
        timings: {
          parseMode,
          requestedMode,
          schemaCompileMs,
          inputPrepMs,
          parseMs,
          workerTotalMs: performance.now() - workerStart
        }
      });
      return;
    } else {
      parseMode = file ? 'file-stream-async' : 'inline-stream-async';
      const input = file ? file.stream() : createXmlStream(xmlInput);
      const inputPrepMs = performance.now() - inputPrepStart;
      const parseStart = performance.now();
      result = await schema.parse(input, parseOptions);
      const parseMs = performance.now() - parseStart;
      self.postMessage({
        id,
        ok: true,
        result,
        xmlSize,
        timings: {
          parseMode,
          requestedMode,
          schemaCompileMs,
          inputPrepMs,
          parseMs,
          workerTotalMs: performance.now() - workerStart
        }
      });
      return;
    }
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  }
};
