---
title: stax-xml
description: API reference for stax-xml
---

**stax-xml**

***

# stax-xml

## Classes

### EventReader

Defined in: async/EventReader.ts:5

#### Implements

- `AsyncIterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReader**(`input`, `options?`): [`EventReader`](#eventreader)

Defined in: async/EventReader.ts:7

###### Parameters

###### input

[`StreamReaderSource`](#streamreadersource)

###### options?

[`EventReaderOptions`](#eventreaderoptions) = `{}`

###### Returns

[`EventReader`](#eventreader)

#### Methods

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: async/EventReader.ts:8

###### Returns

`AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`AsyncIterable.[asyncIterator]`

##### next()

> **next**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: async/EventReader.ts:9

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.next`

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: async/EventReader.ts:10

###### Returns

`Promise`\<`void`\>

##### return()

> **return**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: async/EventReader.ts:11

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.return`

***

### StreamReader

Defined in: async/StreamReader.ts:6

#### Constructors

##### Constructor

> **new StreamReader**(`source`, `options?`): [`StreamReader`](#streamreader)

Defined in: async/StreamReader.ts:14

###### Parameters

###### source

[`StreamReaderSource`](#streamreadersource)

###### options?

[`StreamReaderOptions`](#streamreaderoptions) = `{}`

###### Returns

[`StreamReader`](#streamreader)

#### Methods

##### next()

> **next**(): `Promise`\<[`XmlEventType`](#xmleventtype-1) \| `null`\>

Defined in: async/StreamReader.ts:20

###### Returns

`Promise`\<[`XmlEventType`](#xmleventtype-1) \| `null`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: async/StreamReader.ts:21

###### Returns

`Promise`\<`void`\>

##### eventType()

> **eventType**(): [`XmlEventType`](#xmleventtype-1)

Defined in: async/StreamReader.ts:22

###### Returns

[`XmlEventType`](#xmleventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: async/StreamReader.ts:23

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: async/StreamReader.ts:24

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: async/StreamReader.ts:25

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string`

Defined in: async/StreamReader.ts:26

###### Returns

`string`

##### namespaceURI()

> **namespaceURI**(): `string`

Defined in: async/StreamReader.ts:27

###### Returns

`string`

##### attributeCount()

> **attributeCount**(): `number`

Defined in: async/StreamReader.ts:28

###### Returns

`number`

##### attributeName()

> **attributeName**(`index`): `string` \| `undefined`

Defined in: async/StreamReader.ts:29

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeLocalName()

> **attributeLocalName**(`index`): `string` \| `undefined`

Defined in: async/StreamReader.ts:30

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributePrefix()

> **attributePrefix**(`index`): `string` \| `undefined`

Defined in: async/StreamReader.ts:31

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeNamespaceURI()

> **attributeNamespaceURI**(`index`): `string` \| `undefined`

Defined in: async/StreamReader.ts:32

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeValue()

> **attributeValue**(`indexOrNameOrNamespace`, `localName?`): `string` \| `undefined`

Defined in: async/StreamReader.ts:33

###### Parameters

###### indexOrNameOrNamespace

`string` \| `number`

###### localName?

`string`

###### Returns

`string` \| `undefined`

##### namespaceURIForPrefix()

> **namespaceURIForPrefix**(`prefix`): `string`

Defined in: async/StreamReader.ts:36

###### Parameters

###### prefix

`string`

###### Returns

`string`

***

### Writer

Defined in: async/Writer.ts:120

High-performance asynchronous XML writer implementing the StAX (Streaming API for XML) pattern.

This writer provides efficient streaming XML generation using WritableStream for handling
large XML documents with automatic buffering, backpressure management, and namespace support.

This is an optimized implementation with:
- Optimization 1: Regex caching for entity escaping
- Optimization 2: Attribute string batching
- Optimization 3: Early entity check before regex execution
- Optimization 4: Qualified closing-tag stack (avoid rebuilding end tags)
- Optimization 5: Copy-on-write namespace frames
- Optimization 6: Indentation cache for pretty-print output
- Optimization 7: `TextEncoder.encodeInto()` buffering to reduce intermediate byte arrays
- Optimization 8: Flush by buffer view to avoid per-flush copy slices

#### Remarks

The writer supports streaming output with configurable buffering, automatic entity encoding,
pretty printing with customizable indentation, and comprehensive namespace handling.

#### Examples

Basic usage:
```typescript
const writableStream = new WritableStream({
  write(chunk) {
    console.log(new TextDecoder().decode(chunk));
  }
});

const writer = new Writer(writableStream);
await writer.writeStartElement('root');
await writer.writeElement('item', { id: '1' }, 'Hello World');
await writer.writeEndElement();
await writer.close();
```

With pretty printing:
```typescript
const options = {
  prettyPrint: true,
  indentString: '    ',
  autoEncodeEntities: true
};
const writer = new Writer(writableStream, options);
```

#### Constructors

##### Constructor

> **new Writer**(`stream`, `options?`): [`Writer`](#writer)

Defined in: async/Writer.ts:159

###### Parameters

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

[`WriterOptions`](#writeroptions) = `{}`

###### Returns

[`Writer`](#writer)

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `Promise`\<[`Writer`](#writer)\>

Defined in: async/Writer.ts:280

Write XML declaration

###### Parameters

###### version?

`string` = `'1.0'`

###### encoding?

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeEndDocument()

> **writeEndDocument**(): `Promise`\<`void`\>

Defined in: async/Writer.ts:304

End document (automatically close all elements)

###### Returns

`Promise`\<`void`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: async/Writer.ts:325

Finalize any open elements, flush buffered bytes, and close the underlying stream.

###### Returns

`Promise`\<`void`\>

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `Promise`\<[`Writer`](#writer)\>

Defined in: async/Writer.ts:332

Write start element

###### Parameters

###### localName

`string`

###### options?

[`WriteElementOptions`](#writeelementoptions)

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeEndElement()

> **writeEndElement**(): `Promise`\<[`Writer`](#writer)\>

Defined in: async/Writer.ts:424

Write end element

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCharacters()

> **writeCharacters**(`text`): `Promise`\<[`Writer`](#writer)\>

Defined in: async/Writer.ts:457

Write text

###### Parameters

###### text

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCData()

> **writeCData**(`cdata`): `Promise`\<[`Writer`](#writer)\>

Defined in: async/Writer.ts:479

Write CDATA section

###### Parameters

###### cdata

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeComment()

> **writeComment**(`comment`): `Promise`\<[`Writer`](#writer)\>

Defined in: async/Writer.ts:499

Write comment

###### Parameters

###### comment

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeRaw()

> **writeRaw**(`xml`): `Promise`\<[`Writer`](#writer)\>

Defined in: async/Writer.ts:522

Write raw XML content without escaping

###### Parameters

###### xml

`string`

Raw XML string to write

###### Returns

`Promise`\<[`Writer`](#writer)\>

this (chainable)

##### flush()

> **flush**(): `Promise`\<`void`\>

Defined in: async/Writer.ts:531

Manual flush

###### Returns

`Promise`\<`void`\>

##### getMetrics()

> **getMetrics**(): `object`

Defined in: async/Writer.ts:538

Return metrics

###### Returns

`object`

###### totalBytesWritten

> **totalBytesWritten**: `number` = `0`

###### flushCount

> **flushCount**: `number` = `0`

###### lastFlushTime

> **lastFlushTime**: `number` = `0`

###### bufferUtilization

> **bufferUtilization**: `number`

###### averageFlushSize

> **averageFlushSize**: `number`

***

### EventReaderSync

Defined in: sync/EventReaderSync.ts:6

#### Implements

- `Iterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReaderSync**(`input`, `options?`): [`EventReaderSync`](#eventreadersync)

Defined in: sync/EventReaderSync.ts:9

###### Parameters

###### input

[`StreamReaderSyncInput`](#streamreadersyncinput)

###### options?

[`EventReaderSyncOptions`](#eventreadersyncoptions) = `{}`

###### Returns

[`EventReaderSync`](#eventreadersync)

#### Methods

##### \[iterator\]()

> **\[iterator\]**(): `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: sync/EventReaderSync.ts:10

###### Returns

`Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterable.[iterator]`

##### next()

> **next**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: sync/EventReaderSync.ts:11

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.next`

##### return()

> **return**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: sync/EventReaderSync.ts:17

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.return`

##### close()

> **close**(): `void`

Defined in: sync/EventReaderSync.ts:21

###### Returns

`void`

***

### StreamReaderSync

Defined in: sync/StreamReaderSync.ts:8

Synchronous current-token reader. Strings are scanned directly without encoding.

#### Constructors

##### Constructor

> **new StreamReaderSync**(`input`, `options?`): [`StreamReaderSync`](#streamreadersync)

Defined in: sync/StreamReaderSync.ts:14

###### Parameters

###### input

[`StreamReaderSyncInput`](#streamreadersyncinput)

###### options?

[`StreamReaderSyncOptions`](#streamreadersyncoptions) = `{}`

###### Returns

[`StreamReaderSync`](#streamreadersync)

#### Methods

##### next()

> **next**(): [`XmlEventType`](#xmleventtype-1) \| `null`

Defined in: sync/StreamReaderSync.ts:28

###### Returns

[`XmlEventType`](#xmleventtype-1) \| `null`

##### close()

> **close**(): `void`

Defined in: sync/StreamReaderSync.ts:47

###### Returns

`void`

##### eventType()

> **eventType**(): [`XmlEventType`](#xmleventtype-1)

Defined in: sync/StreamReaderSync.ts:55

###### Returns

[`XmlEventType`](#xmleventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: sync/StreamReaderSync.ts:56

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: sync/StreamReaderSync.ts:57

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: sync/StreamReaderSync.ts:58

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string`

Defined in: sync/StreamReaderSync.ts:59

###### Returns

`string`

##### namespaceURI()

> **namespaceURI**(): `string`

Defined in: sync/StreamReaderSync.ts:60

###### Returns

`string`

##### attributeCount()

> **attributeCount**(): `number`

Defined in: sync/StreamReaderSync.ts:61

###### Returns

`number`

##### attributeName()

> **attributeName**(`index`): `string` \| `undefined`

Defined in: sync/StreamReaderSync.ts:62

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeLocalName()

> **attributeLocalName**(`index`): `string` \| `undefined`

Defined in: sync/StreamReaderSync.ts:63

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributePrefix()

> **attributePrefix**(`index`): `string` \| `undefined`

Defined in: sync/StreamReaderSync.ts:64

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeNamespaceURI()

> **attributeNamespaceURI**(`index`): `string` \| `undefined`

Defined in: sync/StreamReaderSync.ts:65

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeValue()

> **attributeValue**(`indexOrNameOrNamespace`, `localName?`): `string` \| `undefined`

Defined in: sync/StreamReaderSync.ts:66

###### Parameters

###### indexOrNameOrNamespace

`string` \| `number`

###### localName?

`string`

###### Returns

`string` \| `undefined`

##### namespaceURIForPrefix()

> **namespaceURIForPrefix**(`prefix`): `string`

Defined in: sync/StreamReaderSync.ts:71

###### Parameters

###### prefix

`string`

###### Returns

`string`

***

### WriterSync

Defined in: sync/WriterSync.ts:486

String-based sync writer.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSync**(`options?`): [`WriterSync`](#writersync)

Defined in: sync/WriterSync.ts:489

###### Parameters

###### options?

[`WriterSyncOptions`](#writersyncoptions) = `{}`

###### Returns

[`WriterSync`](#writersync)

###### Overrides

`AbstractWriterSync.constructor`

#### Properties

##### state

> `protected` **state**: `number` = `WriterState.INITIAL`

Defined in: sync/WriterSync.ts:78

###### Inherited from

`AbstractWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[] = `[]`

Defined in: sync/WriterSync.ts:79

###### Inherited from

`AbstractWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[] = `[]`

Defined in: sync/WriterSync.ts:80

###### Inherited from

`AbstractWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[] = `[]`

Defined in: sync/WriterSync.ts:81

###### Inherited from

`AbstractWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[] = `[]`

Defined in: sync/WriterSync.ts:82

###### Inherited from

`AbstractWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`WriterSyncOptions`](#writersyncoptions)\>

Defined in: sync/WriterSync.ts:83

###### Inherited from

`AbstractWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number` = `0`

Defined in: sync/WriterSync.ts:84

###### Inherited from

`AbstractWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean` = `false`

Defined in: sync/WriterSync.ts:85

###### Inherited from

`AbstractWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: sync/WriterSync.ts:86

###### Inherited from

`AbstractWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: sync/WriterSync.ts:133

Writes the XML declaration (e.g., <?xml version="1.0" encoding="UTF-8"?>).

###### Parameters

###### version?

`string` = `'1.0'`

###### encoding?

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeStartDocument`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: sync/WriterSync.ts:151

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Inherited from

`AbstractWriterSync.writeEndDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: sync/WriterSync.ts:163

###### Parameters

###### localName

`string`

###### options?

[`WriteElementOptions`](#writeelementoptions)

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeStartElement`

##### writeAttribute()

> **writeAttribute**(`localName`, `value`, `prefix?`): `this`

Defined in: sync/WriterSync.ts:242

###### Parameters

###### localName

`string`

###### value

`string`

###### prefix?

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeAttribute`

##### writeNamespace()

> **writeNamespace**(`prefix`, `uri`): `this`

Defined in: sync/WriterSync.ts:252

###### Parameters

###### prefix

`string`

###### uri

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeNamespace`

##### writeCharacters()

> **writeCharacters**(`text`): `this`

Defined in: sync/WriterSync.ts:269

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: sync/WriterSync.ts:283

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: sync/WriterSync.ts:300

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: sync/WriterSync.ts:315

###### Parameters

###### target

`string`

###### data?

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeProcessingInstruction`

##### writeRaw()

> **writeRaw**(`xml`): `this`

Defined in: sync/WriterSync.ts:337

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: sync/WriterSync.ts:343

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: sync/WriterSync.ts:375

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: sync/WriterSync.ts:380

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: sync/WriterSync.ts:386

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: sync/WriterSync.ts:390

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: sync/WriterSync.ts:412

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: sync/WriterSync.ts:430

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._writeNewline`

##### getXmlString()

> **getXmlString**(): `string`

Defined in: sync/WriterSync.ts:493

###### Returns

`string`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: sync/WriterSync.ts:497

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractWriterSync._emit`

***

### WriterSyncSink

Defined in: sync/WriterSync.ts:505

Sink-based sync writer. Use this for file/buffer incremental writes.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSyncSink**(`sink`, `options?`): [`WriterSyncSink`](#writersyncsink)

Defined in: sync/WriterSync.ts:513

###### Parameters

###### sink

[`SyncTextSink`](#synctextsink)

###### options?

[`WriterSyncSinkOptions`](#writersyncsinkoptions) = `{}`

###### Returns

[`WriterSyncSink`](#writersyncsink)

###### Overrides

`AbstractWriterSync.constructor`

#### Properties

##### state

> `protected` **state**: `number` = `WriterState.INITIAL`

Defined in: sync/WriterSync.ts:78

###### Inherited from

`AbstractWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[] = `[]`

Defined in: sync/WriterSync.ts:79

###### Inherited from

`AbstractWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[] = `[]`

Defined in: sync/WriterSync.ts:80

###### Inherited from

`AbstractWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[] = `[]`

Defined in: sync/WriterSync.ts:81

###### Inherited from

`AbstractWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[] = `[]`

Defined in: sync/WriterSync.ts:82

###### Inherited from

`AbstractWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`WriterSyncOptions`](#writersyncoptions)\>

Defined in: sync/WriterSync.ts:83

###### Inherited from

`AbstractWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number` = `0`

Defined in: sync/WriterSync.ts:84

###### Inherited from

`AbstractWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean` = `false`

Defined in: sync/WriterSync.ts:85

###### Inherited from

`AbstractWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: sync/WriterSync.ts:86

###### Inherited from

`AbstractWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: sync/WriterSync.ts:133

Writes the XML declaration (e.g., <?xml version="1.0" encoding="UTF-8"?>).

###### Parameters

###### version?

`string` = `'1.0'`

###### encoding?

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeStartDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: sync/WriterSync.ts:163

###### Parameters

###### localName

`string`

###### options?

[`WriteElementOptions`](#writeelementoptions)

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeStartElement`

##### writeAttribute()

> **writeAttribute**(`localName`, `value`, `prefix?`): `this`

Defined in: sync/WriterSync.ts:242

###### Parameters

###### localName

`string`

###### value

`string`

###### prefix?

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeAttribute`

##### writeNamespace()

> **writeNamespace**(`prefix`, `uri`): `this`

Defined in: sync/WriterSync.ts:252

###### Parameters

###### prefix

`string`

###### uri

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeNamespace`

##### writeCharacters()

> **writeCharacters**(`text`): `this`

Defined in: sync/WriterSync.ts:269

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: sync/WriterSync.ts:283

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: sync/WriterSync.ts:300

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: sync/WriterSync.ts:315

###### Parameters

###### target

`string`

###### data?

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeProcessingInstruction`

##### writeRaw()

> **writeRaw**(`xml`): `this`

Defined in: sync/WriterSync.ts:337

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: sync/WriterSync.ts:343

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: sync/WriterSync.ts:375

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: sync/WriterSync.ts:380

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: sync/WriterSync.ts:386

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: sync/WriterSync.ts:390

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: sync/WriterSync.ts:412

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: sync/WriterSync.ts:430

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._writeNewline`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: sync/WriterSync.ts:529

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractWriterSync._emit`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: sync/WriterSync.ts:570

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Overrides

`AbstractWriterSync.writeEndDocument`

##### flush()

> **flush**(): `void`

Defined in: sync/WriterSync.ts:578

###### Returns

`void`

##### close()

> **close**(): `void`

Defined in: sync/WriterSync.ts:585

###### Returns

`void`

## Interfaces

### EventReaderOptions

Defined in: async/EventReader.ts:4

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: async/EventReader.ts:4

***

### StreamReaderOptions

Defined in: async/StreamReader.ts:4

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: async/StreamReader.ts:4

***

### WriterOptions

Defined in: async/Writer.ts:20

Configuration options for the Writer

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: async/Writer.ts:26

XML declaration encoding. Writer output is always UTF-8.
Values other than UTF-8 are rejected.

###### Default Value

```ts
'utf-8'
```

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: async/Writer.ts:32

Whether to format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString?**: `string`

Defined in: async/Writer.ts:38

String used for indentation when prettyPrint is true

###### Default Value

```ts
'  '
```

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: async/Writer.ts:44

Additional custom entities to encode

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Default Value

```ts
[]
```

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: async/Writer.ts:50

Whether to automatically encode XML entities

###### Default Value

```ts
true
```

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: async/Writer.ts:56

Internal buffer size in bytes

###### Default Value

```ts
16384
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: async/Writer.ts:62

Automatic flush threshold (percentage of bufferSize)

###### Default Value

```ts
0.8
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: async/Writer.ts:68

Whether to enable automatic flushing

###### Default Value

```ts
true
```

***

### StartDocumentEvent

Defined in: core/types.ts:25

Event fired when the document starts parsing

#### Properties

##### type

> **type**: `"START_DOCUMENT"`

Defined in: core/types.ts:26

***

### EndDocumentEvent

Defined in: core/types.ts:34

Event fired when the document ends parsing

#### Properties

##### type

> **type**: `"END_DOCUMENT"`

Defined in: core/types.ts:35

***

### StartElementEvent

Defined in: core/types.ts:43

Event fired when an XML element starts

#### Properties

##### type

> **type**: `"START_ELEMENT"`

Defined in: core/types.ts:44

##### name

> **name**: `string`

Defined in: core/types.ts:45

##### localName

> **localName**: `string`

Defined in: core/types.ts:46

##### prefix

> **prefix**: `string`

Defined in: core/types.ts:47

##### namespaceURI

> **namespaceURI**: `string`

Defined in: core/types.ts:48

##### attributes

> **attributes**: [`EventAttribute`](#eventattribute)[]

Defined in: core/types.ts:49

***

### EventAttribute

Defined in: core/types.ts:52

#### Properties

##### name

> **name**: `string`

Defined in: core/types.ts:52

##### localName

> **localName**: `string`

Defined in: core/types.ts:52

##### prefix

> **prefix**: `string`

Defined in: core/types.ts:52

##### namespaceURI

> **namespaceURI**: `string`

Defined in: core/types.ts:52

##### value

> **value**: `string`

Defined in: core/types.ts:52

***

### EndElementEvent

Defined in: core/types.ts:54

#### Properties

##### type

> **type**: `"END_ELEMENT"`

Defined in: core/types.ts:55

##### name

> **name**: `string`

Defined in: core/types.ts:56

##### localName

> **localName**: `string`

Defined in: core/types.ts:57

##### prefix

> **prefix**: `string`

Defined in: core/types.ts:58

##### namespaceURI

> **namespaceURI**: `string`

Defined in: core/types.ts:59

***

### CharactersEvent

Defined in: core/types.ts:62

#### Properties

##### type

> **type**: `"CHARACTERS"`

Defined in: core/types.ts:63

##### value

> **value**: `string`

Defined in: core/types.ts:64

***

### CdataEvent

Defined in: core/types.ts:67

#### Properties

##### type

> **type**: `"CDATA"`

Defined in: core/types.ts:68

##### value

> **value**: `string`

Defined in: core/types.ts:69

***

### CommentEvent

Defined in: core/types.ts:72

#### Properties

##### type

> **type**: `"COMMENT"`

Defined in: core/types.ts:72

##### value

> **value**: `string`

Defined in: core/types.ts:72

***

### ProcessingInstructionEvent

Defined in: core/types.ts:73

#### Properties

##### type

> **type**: `"PROCESSING_INSTRUCTION"`

Defined in: core/types.ts:73

##### target

> **target**: `string`

Defined in: core/types.ts:73

##### data

> **data**: `string`

Defined in: core/types.ts:73

***

### DtdEvent

Defined in: core/types.ts:74

#### Properties

##### type

> **type**: `"DTD"`

Defined in: core/types.ts:74

##### value

> **value**: `string`

Defined in: core/types.ts:74

***

### AttributeInfo

Defined in: core/types.ts:93

Attribute information interface

#### Properties

##### value

> **value**: `string`

Defined in: core/types.ts:94

##### localName

> **localName**: `string`

Defined in: core/types.ts:95

##### prefix?

> `optional` **prefix?**: `string`

Defined in: core/types.ts:96

##### uri?

> `optional` **uri?**: `string`

Defined in: core/types.ts:97

***

### WriteElementOptions

Defined in: core/types.ts:164

Element writing options interface (for Writer)

#### Properties

##### prefix?

> `optional` **prefix?**: `string`

Defined in: core/types.ts:165

##### uri?

> `optional` **uri?**: `string`

Defined in: core/types.ts:166

##### attributes?

> `optional` **attributes?**: `Record`\<`string`, `string` \| [`AttributeInfo`](#attributeinfo)\>

Defined in: core/types.ts:167

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: core/types.ts:168

##### comment?

> `optional` **comment?**: `string`

Defined in: core/types.ts:169

***

### EventReaderSyncOptions

Defined in: sync/EventReaderSync.ts:4

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: sync/EventReaderSync.ts:4

***

### StreamReaderSyncOptions

Defined in: sync/StreamReaderSync.ts:4

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: sync/StreamReaderSync.ts:4

***

### SyncTextSink

Defined in: sync/WriterSync.ts:7

Sink interface for custom sync targets.

#### Methods

##### write()

> **write**(`chunk`): `void`

Defined in: sync/WriterSync.ts:8

###### Parameters

###### chunk

`string`

###### Returns

`void`

##### flush()?

> `optional` **flush**(): `void`

Defined in: sync/WriterSync.ts:9

###### Returns

`void`

##### close()?

> `optional` **close**(): `void`

Defined in: sync/WriterSync.ts:10

###### Returns

`void`

***

### WriterSyncOptions

Defined in: sync/WriterSync.ts:16

Writer output options shared by string and sink variants.

#### Extended by

- [`WriterSyncSinkOptions`](#writersyncsinkoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: sync/WriterSync.ts:18

XML declaration encoding. String output is not byte-encoded; only UTF-8 is accepted.

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: sync/WriterSync.ts:19

##### indentString?

> `optional` **indentString?**: `string`

Defined in: sync/WriterSync.ts:20

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: sync/WriterSync.ts:21

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: sync/WriterSync.ts:22

***

### WriterSyncSinkOptions

Defined in: sync/WriterSync.ts:28

Writer options for sink-based sync mode.

#### Extends

- [`WriterSyncOptions`](#writersyncoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: sync/WriterSync.ts:18

XML declaration encoding. String output is not byte-encoded; only UTF-8 is accepted.

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`encoding`](#encoding-1)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: sync/WriterSync.ts:19

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`prettyPrint`](#prettyprint-1)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: sync/WriterSync.ts:20

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`indentString`](#indentstring-1)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: sync/WriterSync.ts:21

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`addEntities`](#addentities-1)

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: sync/WriterSync.ts:22

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`autoEncodeEntities`](#autoencodeentities-1)

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: sync/WriterSync.ts:33

Internal character buffer size.

###### Default Value

```ts
16384
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: sync/WriterSync.ts:39

Emit buffered chunks automatically when threshold is reached.

###### Default Value

```ts
true
```

##### flushOnClose?

> `optional` **flushOnClose?**: `boolean`

Defined in: sync/WriterSync.ts:45

Whether to call sink.flush() when the writer is finalized.

###### Default Value

```ts
false
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: sync/WriterSync.ts:52

Flush threshold (percentage or absolute char count).
If <= 1, treated as percentage of bufferSize. Otherwise absolute char count.

###### Default Value

```ts
0.8
```

## Type Aliases

### StreamReaderSource

> **StreamReaderSource** = `AsyncIterable`\<`Uint8Array`\> \| `ReadableStream`\<`Uint8Array`\>

Defined in: async/StreamReader.ts:3

***

### XmlEventType

> **XmlEventType** = *typeof* [`XmlEventType`](#xmleventtype)\[keyof *typeof* [`XmlEventType`](#xmleventtype)\]

Defined in: core/types.ts:6

Enumeration of XML stream event types used by the StAX parser

***

### AnyXmlEvent

> **AnyXmlEvent** = [`StartDocumentEvent`](#startdocumentevent) \| [`EndDocumentEvent`](#enddocumentevent) \| [`StartElementEvent`](#startelementevent) \| [`EndElementEvent`](#endelementevent) \| [`CharactersEvent`](#charactersevent) \| [`CdataEvent`](#cdataevent) \| [`CommentEvent`](#commentevent) \| [`ProcessingInstructionEvent`](#processinginstructionevent) \| [`DtdEvent`](#dtdevent)

Defined in: core/types.ts:79

Discriminated Union type for developer use

***

### DocumentMode

> **DocumentMode** = `"fragment"` \| `"document"`

Defined in: core/types.ts:183

XML document conformance mode.

***

### StreamReaderSyncInput

> **StreamReaderSyncInput** = `string` \| `Uint8Array` \| `Iterable`\<`Uint8Array`\>

Defined in: sync/StreamReaderSync.ts:3

## Variables

### XmlEventType

> `const` **XmlEventType**: `object`

Defined in: core/types.ts:6

Enumeration of XML stream event types used by the StAX parser

#### Type Declaration

##### START\_DOCUMENT

> `readonly` **START\_DOCUMENT**: `"START_DOCUMENT"` = `'START_DOCUMENT'`

##### END\_DOCUMENT

> `readonly` **END\_DOCUMENT**: `"END_DOCUMENT"` = `'END_DOCUMENT'`

##### START\_ELEMENT

> `readonly` **START\_ELEMENT**: `"START_ELEMENT"` = `'START_ELEMENT'`

##### END\_ELEMENT

> `readonly` **END\_ELEMENT**: `"END_ELEMENT"` = `'END_ELEMENT'`

##### CHARACTERS

> `readonly` **CHARACTERS**: `"CHARACTERS"` = `'CHARACTERS'`

##### CDATA

> `readonly` **CDATA**: `"CDATA"` = `'CDATA'`

##### COMMENT

> `readonly` **COMMENT**: `"COMMENT"` = `'COMMENT'`

##### PROCESSING\_INSTRUCTION

> `readonly` **PROCESSING\_INSTRUCTION**: `"PROCESSING_INSTRUCTION"` = `'PROCESSING_INSTRUCTION'`

##### DTD

> `readonly` **DTD**: `"DTD"` = `'DTD'`

## Functions

### isStartElement()

> **isStartElement**(`event`): `event is StartElementEvent`

Defined in: core/types.ts:110

Type guard function - Check if the event is a START_ELEMENT event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is StartElementEvent`

true if the event is a START_ELEMENT event, false otherwise

***

### isEndElement()

> **isEndElement**(`event`): `event is EndElementEvent`

Defined in: core/types.ts:119

Type guard function - Check if the event is an END_ELEMENT event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is EndElementEvent`

true if the event is an END_ELEMENT event, false otherwise

***

### isCharacters()

> **isCharacters**(`event`): `event is CharactersEvent`

Defined in: core/types.ts:128

Type guard function - Check if the event is a CHARACTERS event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is CharactersEvent`

true if the event is a CHARACTERS event, false otherwise

***

### isCdata()

> **isCdata**(`event`): `event is CdataEvent`

Defined in: core/types.ts:136

Type guard function - Check if the event is a CDATA event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is CdataEvent`

true if the event is a CDATA event, false otherwise

***

### isStartDocument()

> **isStartDocument**(`event`): `event is StartDocumentEvent`

Defined in: core/types.ts:149

Type guard function - Check if the event is a START_DOCUMENT event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is StartDocumentEvent`

true if the event is a START_DOCUMENT event, false otherwise

***

### isEndDocument()

> **isEndDocument**(`event`): `event is EndDocumentEvent`

Defined in: core/types.ts:157

Type guard function - Check if the event is an END_DOCUMENT event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is EndDocumentEvent`

true if the event is an END_DOCUMENT event, false otherwise
