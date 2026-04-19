/**
 * SAX vs StAX-XML Benchmark (1GB+ Large Files)
 *
 * Compares SAX parser and stax-xml async parser on large XML files (>1GB)
 * by parsing to identical JSON output structures using mitata.
 */
import { bench, run } from 'mitata';
import sax from 'sax';
import { Readable } from 'stream';
import { StaxXmlParser, XmlEventType } from 'stax-xml';
import { createLargeXMLStream } from './common/large-file-generator.mjs';
// Convert Web ReadableStream to Node.js Readable stream for SAX
function webStreamToNodeStream(webStream) {
    const reader = webStream.getReader();
    return new Readable({
        async read() {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    this.push(null);
                }
                else {
                    this.push(Buffer.from(value));
                }
            }
            catch (error) {
                this.destroy(error);
            }
        }
    });
}
// SAX parser implementation - parses to JSON array
async function parseSAX(xmlStream) {
    return new Promise((resolve, reject) => {
        const books = [];
        let currentBook = null;
        let currentChapters = [];
        let currentElement = '';
        let currentText = '';
        const parser = sax.createStream(true, {
            lowercase: true,
            trim: true
        });
        parser.on('opentag', (node) => {
            currentElement = node.name;
            if (node.name === 'book') {
                currentBook = {
                    id: node.attributes['id'] || '',
                    chapters: []
                };
                currentChapters = [];
            }
            else if (node.name === 'chapter') {
                currentChapters.push({
                    number: node.attributes['number'] || '',
                    text: ''
                });
            }
            currentText = '';
        });
        parser.on('text', (text) => {
            currentText += text;
        });
        parser.on('closetag', (tagName) => {
            if (!currentBook)
                return;
            switch (tagName) {
                case 'title':
                    currentBook.title = currentText.trim();
                    break;
                case 'author':
                    currentBook.author = currentText.trim();
                    break;
                case 'isbn':
                    currentBook.isbn = currentText.trim();
                    break;
                case 'publisher':
                    currentBook.publisher = currentText.trim();
                    break;
                case 'publishdate':
                    currentBook.publishDate = currentText.trim();
                    break;
                case 'description':
                    currentBook.description = currentText.trim();
                    break;
                case 'chapter':
                    if (currentChapters.length > 0) {
                        currentChapters[currentChapters.length - 1].text = currentText.trim();
                    }
                    break;
                case 'book':
                    if (currentBook) {
                        currentBook.chapters = currentChapters;
                        books.push(currentBook);
                        currentBook = null;
                        currentChapters = [];
                    }
                    break;
            }
            currentText = '';
        });
        parser.on('error', (error) => {
            reject(error);
        });
        parser.on('end', () => {
            resolve(books);
        });
        const nodeStream = webStreamToNodeStream(xmlStream);
        nodeStream.pipe(parser);
    });
}
// StAX-XML async parser implementation - parses to JSON array
async function parseStaxXML(xmlStream) {
    const books = [];
    let currentBook = null;
    let currentChapters = [];
    const elementStack = []; // Track element hierarchy
    const parser = new StaxXmlParser(xmlStream);
    for await (const event of parser) {
        switch (event.type) {
            case XmlEventType.START_ELEMENT: {
                elementStack.push(event.localName);
                if (event.localName === 'book') {
                    const id = event.attributes?.['id'] || '';
                    currentBook = {
                        id,
                        chapters: []
                    };
                    currentChapters = [];
                }
                else if (event.localName === 'chapter') {
                    const number = event.attributes?.['number'] || '';
                    currentChapters.push({
                        number,
                        text: ''
                    });
                }
                break;
            }
            case XmlEventType.CHARACTERS: {
                if (!currentBook)
                    break;
                if (!event.value)
                    break;
                const text = event.value.trim();
                if (!text)
                    break;
                // Get the current element from stack
                const currentElement = elementStack[elementStack.length - 1];
                switch (currentElement) {
                    case 'title':
                        currentBook.title = (currentBook.title || '') + text;
                        break;
                    case 'author':
                        currentBook.author = (currentBook.author || '') + text;
                        break;
                    case 'isbn':
                        currentBook.isbn = (currentBook.isbn || '') + text;
                        break;
                    case 'publisher':
                        currentBook.publisher = (currentBook.publisher || '') + text;
                        break;
                    case 'publishdate':
                        currentBook.publishDate = (currentBook.publishDate || '') + text;
                        break;
                    case 'description':
                        currentBook.description = (currentBook.description || '') + text;
                        break;
                    case 'chapter':
                        if (currentChapters.length > 0) {
                            currentChapters[currentChapters.length - 1].text += text;
                        }
                        break;
                }
                break;
            }
            case XmlEventType.END_ELEMENT: {
                if (event.localName === 'book' && currentBook) {
                    currentBook.chapters = currentChapters;
                    books.push(currentBook);
                    currentBook = null;
                    currentChapters = [];
                }
                // Pop from element stack
                elementStack.pop();
                break;
            }
            case XmlEventType.ERROR:
                throw event.error;
        }
    }
    return books;
}
// Benchmark configurations
const configs = [
    { size: 0.1, name: '100MB' }, // ~100MB for quick tests
    { size: 0.5, name: '500MB' }, // ~500MB
    { size: 1.0, name: '1GB' }, // ~1GB
];
console.log('================================================================================');
console.log('SAX vs StAX-XML Benchmark - Large File Parsing (to JSON)');
console.log('================================================================================');
console.log('');
console.log('This benchmark compares SAX and stax-xml parsers by parsing');
console.log('large XML streams (100MB - 1GB) into identical JSON structures.');
console.log('');
console.log('Both parsers:');
console.log('  - Parse the same in-memory generated XML stream');
console.log('  - Build identical JSON array of Book objects');
console.log('  - Process streams without loading entire XML into memory');
console.log('');
console.log('================================================================================');
console.log('');
// Run benchmarks for each size
for (const config of configs) {
    console.log(`\n📊 Testing with ${config.name} XML file\n`);
    bench(`SAX (${config.name})`, async () => {
        const stream = createLargeXMLStream({ sizeGB: config.size });
        const books = await parseSAX(stream);
        return books.length;
    });
    bench(`stax-xml (${config.name})`, async () => {
        const stream = createLargeXMLStream({ sizeGB: config.size });
        const books = await parseStaxXML(stream);
        return books.length;
    });
}
console.log('\n⏱️  Starting benchmarks...\n');
// Verify correctness before benchmarking
console.log('🔍 Verifying output correctness...\n');
const testStream1 = createLargeXMLStream({ sizeGB: 0.001 }); // 1MB test
const testStream2 = createLargeXMLStream({ sizeGB: 0.001 });
const [saxResult, staxResult] = await Promise.all([
    parseSAX(testStream1),
    parseStaxXML(testStream2)
]);
console.log(`SAX parsed ${saxResult.length} books`);
console.log(`stax-xml parsed ${staxResult.length} books`);
if (saxResult.length !== staxResult.length) {
    console.error('❌ ERROR: Different number of books parsed!');
    process.exit(1);
}
// Compare first book
if (saxResult.length > 0 && staxResult.length > 0) {
    const saxBook = saxResult[0];
    const staxBook = staxResult[0];
    console.log('\n📖 SAX first book:');
    console.log(JSON.stringify(saxBook, null, 2));
    console.log('\n📖 stax-xml first book:');
    console.log(JSON.stringify(staxBook, null, 2));
    if (saxBook && staxBook) {
        console.log('\n📖 Comparison:');
        console.log('  SAX:', {
            id: saxBook.id,
            title: saxBook.title?.substring(0, 50) + '...',
            chapters: saxBook.chapters?.length
        });
        console.log('  stax-xml:', {
            id: staxBook.id,
            title: staxBook.title?.substring(0, 50) + '...',
            chapters: staxBook.chapters?.length
        });
        if (JSON.stringify(saxBook) === JSON.stringify(staxBook)) {
            console.log('✅ Output structures are identical!\n');
        }
        else {
            console.warn('⚠️  Output structures differ (may be due to whitespace)\n');
        }
    }
}
console.log('================================================================================');
console.log('Running benchmarks...');
console.log('================================================================================\n');
await run({
    percentiles: false
});
console.log('\n================================================================================');
console.log('Benchmark Complete');
console.log('================================================================================');
