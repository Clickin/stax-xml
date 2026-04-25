// @ts-nocheck
import { x } from 'stax-xml/converter';
import {
  JS_CONVERTER_BACKEND,
  WASM_CONVERTER_BACKEND,
  parseTextWithSelectedConverterBackend
} from './converter-wasm-backend.ts';
import ConverterDemoWorker from './converter-demo-worker.ts?worker';

function resetFileInputValue(fileInput) {
  if (!fileInput) {
    return;
  }

  fileInput.value = '';
}

let loadedFile = null;
let parseWorker = null;
let parseWorkerRequestId = 0;
const LARGE_INPUT_THRESHOLD = 5 * 1024 * 1024;
const LARGE_INPUT_MAX_EVENTS = 5_000_000;
const CONVERTER_BACKEND = JS_CONVERTER_BACKEND;
const PREFERRED_CONVERTER_BACKEND = WASM_CONVERTER_BACKEND;

const examples = {
  basic: {
    name: 'Basic Object',
    xml: `<book>
  <title>TypeScript Handbook</title>
  <author>Microsoft</author>
  <price>29.99</price>
  <year>2024</year>
</book>`,
    schema: `x.object({
  title: x.string().xpath('/book/title'),
  author: x.string().xpath('/book/author'),
  price: x.number().xpath('/book/price'),
  year: x.number().xpath('/book/year')
})`
  },

  array: {
    name: 'Array Parsing',
    xml: `<list>
  <item>Apple</item>
  <item>Banana</item>
  <item>Cherry</item>
  <item>Date</item>
</list>`,
    schema: `x.array(
  x.string(),
  '//item'
)`
  },

  nested: {
    name: 'Nested Object',
    xml: `<product>
  <name>Laptop Pro</name>
  <price>999.99</price>
  <specs>
    <cpu>Intel i7</cpu>
    <ram>16GB</ram>
    <storage>512GB SSD</storage>
  </specs>
</product>`,
    schema: `x.object({
  name: x.string().xpath('/product/name'),
  price: x.number().xpath('/product/price'),
  cpu: x.string().xpath('/product/specs/cpu'),
  ram: x.string().xpath('/product/specs/ram'),
  storage: x.string().xpath('/product/specs/storage')
})`
  },

  transform: {
    name: 'With Transform',
    xml: `<person>
  <firstName>John</firstName>
  <lastName>Doe</lastName>
  <age>30</age>
</person>`,
    schema: `x.object({
  firstName: x.string().xpath('/person/firstName'),
  lastName: x.string().xpath('/person/lastName'),
  age: x.number().xpath('/person/age')
}).transform(p => ({
  fullName: p.firstName + ' ' + p.lastName,
  age: p.age,
  isAdult: p.age >= 18
}))`
  },

  optional: {
    name: 'With Optional',
    xml: `<user>
  <id>123</id>
  <username>johndoe</username>
  <email>john@example.com</email>
</user>`,
    schema: `x.object({
  id: x.number().xpath('/user/id'),
  username: x.string().xpath('/user/username'),
  email: x.string().xpath('/user/email').optional(),
  phone: x.string().xpath('/user/phone').optional()
})`
  },

  validation: {
    name: 'Number Validation',
    xml: `<data>
  <age>25</age>
  <score>95</score>
  <count>42</count>
</data>`,
    schema: `x.object({
  age: x.number().xpath('/data/age').min(0).max(120).int(),
  score: x.number().xpath('/data/score').min(0).max(100),
  count: x.number().xpath('/data/count').int()
})`
  },

  rss: {
    name: 'RSS Feed',
    xml: `<rss version="2.0">
  <channel>
    <title>Tech Blog</title>
    <link>https://techblog.example.com</link>
    <item>
      <title>TypeScript 5.0 Released</title>
      <link>https://techblog.example.com/ts5</link>
      <pubDate>2024-01-15</pubDate>
    </item>
    <item>
      <title>React 19 Features</title>
      <link>https://techblog.example.com/react19</link>
      <pubDate>2024-01-16</pubDate>
    </item>
  </channel>
</rss>`,
    schema: `x.object({
  title: x.string().xpath('/rss/channel/title'),
  link: x.string().xpath('/rss/channel/link'),
  items: x.array(
    x.object({
      title: x.string().xpath('./title'),
      link: x.string().xpath('./link'),
      pubDate: x.string().xpath('./pubDate')
    }),
    '//item'
  )
})`
  },

  ecommerce: {
    name: 'E-commerce Product',
    xml: `<product id="123" category="electronics">
  <name>Wireless Mouse</name>
  <price currency="USD">29.99</price>
  <stock>50</stock>
  <tags>
    <tag>wireless</tag>
    <tag>bluetooth</tag>
    <tag>ergonomic</tag>
  </tags>
</product>`,
    schema: `x.object({
  id: x.number().xpath('/product/@id'),
  category: x.string().xpath('/product/@category'),
  name: x.string().xpath('/product/name'),
  price: x.number().xpath('/product/price').min(0),
  currency: x.string().xpath('/product/price/@currency'),
  stock: x.number().xpath('/product/stock').int(),
  tags: x.array(x.string(), '//tag')
}).transform(p => ({
  ...p,
  inStock: p.stock > 0
}))`
  },

  attributes: {
    name: 'XPath Attributes',
    xml: `<users>
  <user role="admin">
    <username>Alice</username>
  </user>
  <user role="user">
    <username>Bob</username>
  </user>
  <user role="admin">
    <username>Charlie</username>
  </user>
</users>`,
    schema: `x.array(
  x.object({
    username: x.string().xpath('./username'),
    role: x.string().xpath('./@role')
  }),
  '//user'
)`
  },

  large: {
    name: 'Large Dataset (1000 items)',
    xml: '<items>' + Array.from({ length: 1000 }, (_, i) =>
      `<item><id>${i + 1}</id><value>Data ${i + 1}</value></item>`
    ).join('') + '</items>',
    schema: `x.array(
  x.object({
    id: x.number().xpath('./id'),
    value: x.string().xpath('./value')
  }),
  '//item'
)`
  },

  midsizeBenchmark: {
    name: 'Midsize Benchmark (packages/benchmark/assets)',
    preferredMode: 'async',
    note: 'Load `packages/benchmark/assets/midsize.xml` and keep Async mode selected. The demo will raise `maxEvents` automatically for large inputs.',
    xml: `<!-- Load packages/benchmark/assets/midsize.xml to test the full benchmark fixture -->
<any_name attr="https://example.com/somepath">
  <person id="101">
    <phone>+122233344550</phone>
    <name>Jack</name>
    <phone>+122233344551</phone>
    <age>33</age>
    <emptyNode></emptyNode>
    <booleanNode>false</booleanNode>
    <booleanNode>true</booleanNode>
    <married firstTime="No" attr="val 2">Yes</married>
    <birthday>Wed, 28 Mar 1979 12:13:14 +0300</birthday>
  </person>
  <person id="102">
    <phone>+122233344553</phone>
    <name>Boris</name>
    <phone>+122233344554</phone>
    <age>34</age>
    <married firstTime="Yes">Yes</married>
    <birthday>Mon, 31 Aug 1970 02:03:04 +0300</birthday>
  </person>
</any_name>`,
    schema: `x.array(
  x.object({
    id: x.number().xpath('./@id').int(),
    name: x.string().xpath('./name'),
    age: x.number().xpath('./age').int(),
    primaryPhone: x.string().xpath('./phone[1]'),
    secondaryPhone: x.string().xpath('./phone[2]').optional(),
    birthday: x.string().xpath('./birthday'),
    married: x.string().xpath('./married'),
    firstTime: x.string().xpath('./married/@firstTime'),
    hasEmptyNode: x.string().xpath('./emptyNode').optional().transform(value => value !== undefined),
    firstBoolean: x.string().xpath('./booleanNode[1]').optional().transform(value => value === 'true')
  }),
  '//person'
).transform(people => ({
  personCount: people.length,
  uniqueNames: [...new Set(people.map(person => person.name))],
  firstFive: people.slice(0, 5),
  lastFive: people.slice(-5)
}))`
  }
};

const exampleButtons = document.getElementById('exampleButtons');
const xmlInputEl = document.getElementById('xmlInput');
const schemaInputEl = document.getElementById('schemaInput');
const outputEl = document.getElementById('output');
const messageEl = document.getElementById('message');
const parseTimeEl = document.getElementById('parseTime');
const modeEl = document.getElementById('mode');
const xmlSizeEl = document.getElementById('xmlSize');
const throughputEl = document.getElementById('throughput');
const backendEl = document.getElementById('backend');
const parseBtn = document.getElementById('parseBtn');
const clearBtn = document.getElementById('clearBtn');
const fileInputEl = document.getElementById('fileInput');

Object.entries(examples).forEach(([key, example]) => {
  const btn = document.createElement('button');
  btn.className = 'example-btn';
  btn.textContent = example.name;
  btn.onclick = () => loadExample(key);
  exampleButtons.appendChild(btn);
});

function loadExample(key) {
  const example = examples[key];
  if (!example) {
    return;
  }

  xmlInputEl.value = example.xml;
  schemaInputEl.value = example.schema;
  clearOutput();

  if (example.preferredMode) {
    const preferredModeInput = document.querySelector(`input[name="mode"][value="${example.preferredMode}"]`);
    if (preferredModeInput) {
      preferredModeInput.checked = true;
    }
  }

  if (example.note) {
    messageEl.innerHTML = `<div class="info">ℹ️ ${example.note}</div>`;
  }

  document.querySelectorAll('.example-btn').forEach((btn) => {
    btn.classList.remove('active');
    if (btn.textContent === example.name) {
      btn.classList.add('active');
    }
  });
}

function clearOutput() {
  outputEl.textContent = 'Click "Parse XML" to see the result...';
  messageEl.innerHTML = '';
  parseTimeEl.textContent = '-';
  modeEl.textContent = '-';
  xmlSizeEl.textContent = '-';
  throughputEl.textContent = '-';
  backendEl.textContent = PREFERRED_CONVERTER_BACKEND.label;
  backendEl.title = PREFERRED_CONVERTER_BACKEND.detail;
  resetFileInputValue(fileInputEl);
  loadedFile = null;
}

function getParseWorker() {
  if (!parseWorker) {
    parseWorker = new ConverterDemoWorker();
  }
  return parseWorker;
}

function parseXmlInWorker({ schemaInput, xmlInput, file, parseOptions, requestedMode, requestedBackend }) {
  const worker = getParseWorker();
  const requestId = ++parseWorkerRequestId;

  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      if (event.data?.id !== requestId) {
        return;
      }

      cleanup();

      if (event.data.ok) {
        resolve(event.data);
        return;
      }

      reject(new Error(event.data.errorMessage || 'Worker parse failed'));
    };

    const handleError = (event) => {
      cleanup();
      reject(event.error || new Error(event.message || 'Worker parse failed'));
    };

    const cleanup = () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage({
      id: requestId,
      schemaInput,
      xmlInput,
      file: file ?? null,
      parseOptions,
      requestedMode,
      requestedBackend
    });
  });
}

async function parseXML() {
  const xmlInput = xmlInputEl.value;
  const schemaInput = schemaInputEl.value;
  const modeInput = document.querySelector('input[name="mode"]:checked');
  const backendInput = document.querySelector('input[name="backendMode"]:checked');
  const mode = modeInput?.value ?? 'sync';
  const backendMode = backendInput?.value ?? 'wasm';

  if (!schemaInput) {
    messageEl.innerHTML = '<div class="error">⚠️ Please provide schema definition</div>';
    return;
  }

  if (!loadedFile && !xmlInput) {
    messageEl.innerHTML = '<div class="error">⚠️ Please provide XML input or load a file</div>';
    return;
  }

  messageEl.innerHTML = '';
  parseBtn.disabled = true;

  const startTime = performance.now();

  try {
    let result;
    let xmlSize;
    let workerTimings = null;
    let activeBackend = CONVERTER_BACKEND;
    const inputSize = loadedFile ? loadedFile.size : new Blob([xmlInput]).size;
    const parseOptions = inputSize > LARGE_INPUT_THRESHOLD
      ? { maxEvents: LARGE_INPUT_MAX_EVENTS }
      : undefined;

    if (mode === 'sync') {
      if (loadedFile && loadedFile.size > 10 * 1024 * 1024) {
        messageEl.innerHTML = '<div class="error">⚠️ Files over 10MB must use async mode</div>';
        return;
      }
      const schemaFunction = new Function('x', `return ${schemaInput}`);
      const schema = schemaFunction(x);
      const backendResult = await parseTextWithSelectedConverterBackend(schema, xmlInput, parseOptions, 'sync', backendMode);
      result = backendResult.result;
      activeBackend = backendResult.backend;
      workerTimings = backendResult.timings;
      xmlSize = inputSize;
    } else {
      const workerResponse = await parseXmlInWorker({
        schemaInput,
        xmlInput,
        file: loadedFile,
        parseOptions,
        requestedMode: mode,
        requestedBackend: backendMode
      });
      result = workerResponse.result;
      xmlSize = workerResponse.xmlSize;
      activeBackend = workerResponse.backend ?? CONVERTER_BACKEND;
      workerTimings = workerResponse.timings ?? null;
      if (workerTimings) {
        console.info('converter-demo timings', workerTimings);
      }
    }

    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const durationLabel = durationMs.toFixed(2);

    outputEl.textContent = JSON.stringify(result, null, 2);
    parseTimeEl.textContent = durationLabel;
    modeEl.textContent = mode.toUpperCase();
    xmlSizeEl.textContent = xmlSize.toLocaleString();
    backendEl.textContent = activeBackend.label;
    backendEl.title = activeBackend.detail;
    const throughput = ((xmlSize / 1024) / (durationMs / 1000)).toFixed(2);
    throughputEl.textContent = throughput;

    const parseOptionSuffix = parseOptions
      ? ` with maxEvents=${parseOptions.maxEvents.toLocaleString()}`
      : '';
    const timingSuffix = mode === 'async' && typeof workerTimings?.workerTotalMs === 'number'
      ? ` (worker ${workerTimings.workerTotalMs.toFixed(2)}ms, parse ${workerTimings.parseMs.toFixed(2)}ms, mode ${workerTimings.parseMode})`
      : '';
    messageEl.innerHTML = `<div class="success">✅ Successfully parsed XML in ${durationLabel}ms using ${mode} mode on ${activeBackend.label}${parseOptionSuffix}${timingSuffix}.</div>`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputEl.textContent = '';
    messageEl.innerHTML = `<div class="error">❌ Error: ${errorMessage}</div>`;
    console.error('Parse error:', error);
  } finally {
    parseBtn.disabled = false;
  }
}

async function loadFile() {
  const file = fileInputEl.files?.[0];

  if (!file) {
    messageEl.innerHTML = '<div class="error">⚠️ Please select a file</div>';
    return;
  }

  const maxSize = 10 * 1024 * 1024;
  const isLargeFile = file.size > maxSize;

  try {
    loadedFile = file;

    if (isLargeFile) {
      const asyncModeInput = document.querySelector('input[name="mode"][value="async"]');
      if (asyncModeInput) {
        asyncModeInput.checked = true;
      }
      xmlInputEl.value = `[Large file loaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)]`;
      messageEl.innerHTML = `<div class="info">ℹ️ Large file loaded. Async mode required for files over 10MB. File will be streamed during parsing with maxEvents=${LARGE_INPUT_MAX_EVENTS.toLocaleString()}.</div>`;
      return;
    }

    const text = await file.text();
    xmlInputEl.value = text;
    const sizeKB = (file.size / 1024).toFixed(2);
    messageEl.innerHTML = `<div class="success">✅ Loaded file: ${file.name} (${sizeKB} KB)</div>`;

    setTimeout(() => {
      messageEl.innerHTML = '';
    }, 3000);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error loading file:', error);
    messageEl.innerHTML = `<div class="error">❌ Failed to load file: ${errorMessage}</div>`;
    loadedFile = null;
  }
}

parseBtn.addEventListener('click', parseXML);
clearBtn.addEventListener('click', clearOutput);
fileInputEl.addEventListener('change', loadFile);
window.addEventListener('beforeunload', () => {
  if (parseWorker) {
    parseWorker.terminate();
    parseWorker = null;
  }
});

loadExample('basic');
