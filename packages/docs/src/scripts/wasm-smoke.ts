const LOG_PREFIX = '[stax-xml wasm smoke]';

const statusEl = document.getElementById('wasm-status');
const outputEl = document.getElementById('wasm-output');

function setStatus(kind: 'pending' | 'ok' | 'error', text: string): void {
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.dataset.status = kind;
  }
}

function setOutput(value: unknown): void {
  if (outputEl) {
    outputEl.textContent = JSON.stringify(value, null, 2);
  }
}

async function runWasmSmoke(): Promise<void> {
  setStatus('pending', 'Loading @stax-xml/native-wasm32-wasi browser build...');
  console.info(`${LOG_PREFIX} start`, {
    crossOriginIsolated: globalThis.crossOriginIsolated,
  });

  try {
    const wasm = await import('@stax-xml/native-wasm32-wasi');
    const xml = '<root><item id="1">hello</item></root>';
    const result = wasm.parseAggregateStringUtf8(xml, 'count-only');
    const eventCount = result.eventCount ?? result.event_count;
    const evidence = {
      backend: '@stax-xml/native-wasm32-wasi',
      crossOriginIsolated: globalThis.crossOriginIsolated,
      eventCount,
      result,
    };

    if (eventCount !== 7) {
      throw new Error(`Unexpected wasm event count: ${eventCount}`);
    }

    setStatus('ok', 'Wasm package loaded and parsed the smoke XML.');
    setOutput(evidence);
    console.info(`${LOG_PREFIX} ok`, evidence);
  } catch (error) {
    setStatus('error', error instanceof Error ? error.message : String(error));
    setOutput({
      backend: '@stax-xml/native-wasm32-wasi',
      crossOriginIsolated: globalThis.crossOriginIsolated,
      error: error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error,
    });
    console.error(`${LOG_PREFIX} error`, error);
  }
}

void runWasmSmoke();
