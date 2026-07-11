---
title: stax-xml
description: API reference for stax-xml
slug: v1.0.0/api/main
---

**stax-xml**

***

# stax-xml

## Classes

### StreamReader

Defined in: stax-xml-async/dist/index.d.ts:8

#### Constructors

##### Constructor

> **new StreamReader**(`source`, `options?`): [`StreamReader`](#streamreader)

Defined in: stax-xml-async/dist/index.d.ts:15

###### Parameters

###### source

[`StreamReaderSource`](#streamreadersource)

###### options?

[`StreamReaderOptions`](#streamreaderoptions)

###### Returns

[`StreamReader`](#streamreader)

#### Methods

##### next()

> **next**(): `Promise`\<[`XmlEventType`](#xmleventtype-1) \| `null`\>

Defined in: stax-xml-async/dist/index.d.ts:16

###### Returns

`Promise`\<[`XmlEventType`](#xmleventtype-1) \| `null`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: stax-xml-async/dist/index.d.ts:17

###### Returns

`Promise`\<`void`\>

##### eventType()

> **eventType**(): [`XmlEventType`](#xmleventtype-1)

Defined in: stax-xml-async/dist/index.d.ts:18

###### Returns

[`XmlEventType`](#xmleventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: stax-xml-async/dist/index.d.ts:19

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: stax-xml-async/dist/index.d.ts:20

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: stax-xml-async/dist/index.d.ts:21

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string`

Defined in: stax-xml-async/dist/index.d.ts:22

###### Returns

`string`

##### namespaceURI()

> **namespaceURI**(): `string`

Defined in: stax-xml-async/dist/index.d.ts:23

###### Returns

`string`

##### attributeCount()

> **attributeCount**(): `number`

Defined in: stax-xml-async/dist/index.d.ts:24

###### Returns

`number`

##### attributeName()

> **attributeName**(`index`): `string` \| `undefined`

Defined in: stax-xml-async/dist/index.d.ts:25

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeLocalName()

> **attributeLocalName**(`index`): `string` \| `undefined`

Defined in: stax-xml-async/dist/index.d.ts:26

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributePrefix()

> **attributePrefix**(`index`): `string` \| `undefined`

Defined in: stax-xml-async/dist/index.d.ts:27

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeNamespaceURI()

> **attributeNamespaceURI**(`index`): `string` \| `undefined`

Defined in: stax-xml-async/dist/index.d.ts:28

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeValue()

> **attributeValue**(`indexOrNameOrNamespace`, `localName?`): `string` \| `undefined`

Defined in: stax-xml-async/dist/index.d.ts:29

###### Parameters

###### indexOrNameOrNamespace

`string` \| `number`

###### localName?

`string`

###### Returns

`string` \| `undefined`

##### namespaceURIForPrefix()

> **namespaceURIForPrefix**(`prefix`): `string`

Defined in: stax-xml-async/dist/index.d.ts:30

###### Parameters

###### prefix

`string`

###### Returns

`string`

***

### EventReader

Defined in: stax-xml-async/dist/index.d.ts:37

#### Implements

- `AsyncIterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReader**(`input`, `options?`): [`EventReader`](#eventreader)

Defined in: stax-xml-async/dist/index.d.ts:39

###### Parameters

###### input

[`StreamReaderSource`](#streamreadersource)

###### options?

[`EventReaderOptions`](#eventreaderoptions)

###### Returns

[`EventReader`](#eventreader)

#### Methods

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: stax-xml-async/dist/index.d.ts:40

###### Returns

`AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`AsyncIterable.[asyncIterator]`

##### next()

> **next**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: stax-xml-async/dist/index.d.ts:41

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.next`

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: stax-xml-async/dist/index.d.ts:42

###### Returns

`Promise`\<`void`\>

##### return()

> **return**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: stax-xml-async/dist/index.d.ts:43

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.return`

***

### Writer

Defined in: stax-xml-async/dist/index.d.ts:147

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

Defined in: stax-xml-async/dist/index.d.ts:167

###### Parameters

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

[`WriterOptions`](#writeroptions)

###### Returns

[`Writer`](#writer)

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `Promise`\<[`Writer`](#writer)\>

Defined in: stax-xml-async/dist/index.d.ts:179

Write XML declaration

###### Parameters

###### version?

`string`

###### encoding?

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeEndDocument()

> **writeEndDocument**(): `Promise`\<`void`\>

Defined in: stax-xml-async/dist/index.d.ts:183

End document (automatically close all elements)

###### Returns

`Promise`\<`void`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: stax-xml-async/dist/index.d.ts:187

Finalize any open elements, flush buffered bytes, and close the underlying stream.

###### Returns

`Promise`\<`void`\>

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `Promise`\<[`Writer`](#writer)\>

Defined in: stax-xml-async/dist/index.d.ts:191

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

Defined in: stax-xml-async/dist/index.d.ts:195

Write end element

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCharacters()

> **writeCharacters**(`text`): `Promise`\<[`Writer`](#writer)\>

Defined in: stax-xml-async/dist/index.d.ts:199

Write text

###### Parameters

###### text

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCData()

> **writeCData**(`cdata`): `Promise`\<[`Writer`](#writer)\>

Defined in: stax-xml-async/dist/index.d.ts:203

Write CDATA section

###### Parameters

###### cdata

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeComment()

> **writeComment**(`comment`): `Promise`\<[`Writer`](#writer)\>

Defined in: stax-xml-async/dist/index.d.ts:207

Write comment

###### Parameters

###### comment

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeRaw()

> **writeRaw**(`xml`): `Promise`\<[`Writer`](#writer)\>

Defined in: stax-xml-async/dist/index.d.ts:213

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

Defined in: stax-xml-async/dist/index.d.ts:217

Manual flush

###### Returns

`Promise`\<`void`\>

##### getMetrics()

> **getMetrics**(): `object`

Defined in: stax-xml-async/dist/index.d.ts:221

Return metrics

###### Returns

`object`

###### bufferUtilization

> **bufferUtilization**: `number`

###### averageFlushSize

> **averageFlushSize**: `number`

###### totalBytesWritten

> **totalBytesWritten**: `number`

###### flushCount

> **flushCount**: `number`

###### lastFlushTime

> **lastFlushTime**: `number`

***

### StreamReaderSync

Defined in: stax-xml-sync/dist/index.d.ts:9

Synchronous current-token reader. Strings are scanned directly without encoding.

#### Constructors

##### Constructor

> **new StreamReaderSync**(`input`, `options?`): [`StreamReaderSync`](#streamreadersync)

Defined in: stax-xml-sync/dist/index.d.ts:14

###### Parameters

###### input

[`StreamReaderSyncInput`](#streamreadersyncinput)

###### options?

[`StreamReaderSyncOptions`](#streamreadersyncoptions)

###### Returns

[`StreamReaderSync`](#streamreadersync)

#### Methods

##### next()

> **next**(): [`XmlEventType`](#xmleventtype-1) \| `null`

Defined in: stax-xml-sync/dist/index.d.ts:15

###### Returns

[`XmlEventType`](#xmleventtype-1) \| `null`

##### close()

> **close**(): `void`

Defined in: stax-xml-sync/dist/index.d.ts:16

###### Returns

`void`

##### eventType()

> **eventType**(): [`XmlEventType`](#xmleventtype-1)

Defined in: stax-xml-sync/dist/index.d.ts:17

###### Returns

[`XmlEventType`](#xmleventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: stax-xml-sync/dist/index.d.ts:18

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: stax-xml-sync/dist/index.d.ts:19

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: stax-xml-sync/dist/index.d.ts:20

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string`

Defined in: stax-xml-sync/dist/index.d.ts:21

###### Returns

`string`

##### namespaceURI()

> **namespaceURI**(): `string`

Defined in: stax-xml-sync/dist/index.d.ts:22

###### Returns

`string`

##### attributeCount()

> **attributeCount**(): `number`

Defined in: stax-xml-sync/dist/index.d.ts:23

###### Returns

`number`

##### attributeName()

> **attributeName**(`index`): `string` \| `undefined`

Defined in: stax-xml-sync/dist/index.d.ts:24

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeLocalName()

> **attributeLocalName**(`index`): `string` \| `undefined`

Defined in: stax-xml-sync/dist/index.d.ts:25

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributePrefix()

> **attributePrefix**(`index`): `string` \| `undefined`

Defined in: stax-xml-sync/dist/index.d.ts:26

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeNamespaceURI()

> **attributeNamespaceURI**(`index`): `string` \| `undefined`

Defined in: stax-xml-sync/dist/index.d.ts:27

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeValue()

> **attributeValue**(`indexOrNameOrNamespace`, `localName?`): `string` \| `undefined`

Defined in: stax-xml-sync/dist/index.d.ts:28

###### Parameters

###### indexOrNameOrNamespace

`string` \| `number`

###### localName?

`string`

###### Returns

`string` \| `undefined`

##### namespaceURIForPrefix()

> **namespaceURIForPrefix**(`prefix`): `string`

Defined in: stax-xml-sync/dist/index.d.ts:29

###### Parameters

###### prefix

`string`

###### Returns

`string`

***

### EventReaderSync

Defined in: stax-xml-sync/dist/index.d.ts:36

#### Implements

- `Iterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReaderSync**(`input`, `options?`): [`EventReaderSync`](#eventreadersync)

Defined in: stax-xml-sync/dist/index.d.ts:39

###### Parameters

###### input

[`StreamReaderSyncInput`](#streamreadersyncinput)

###### options?

[`EventReaderSyncOptions`](#eventreadersyncoptions)

###### Returns

[`EventReaderSync`](#eventreadersync)

#### Methods

##### \[iterator\]()

> **\[iterator\]**(): `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: stax-xml-sync/dist/index.d.ts:40

###### Returns

`Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterable.[iterator]`

##### next()

> **next**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: stax-xml-sync/dist/index.d.ts:41

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.next`

##### return()

> **return**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: stax-xml-sync/dist/index.d.ts:42

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.return`

##### close()

> **close**(): `void`

Defined in: stax-xml-sync/dist/index.d.ts:43

###### Returns

`void`

***

### WriterSync

Defined in: stax-xml-sync/dist/index.d.ts:144

String-based sync writer.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSync**(`options?`): [`WriterSync`](#writersync)

Defined in: stax-xml-sync/dist/index.d.ts:146

###### Parameters

###### options?

[`WriterSyncOptions`](#writersyncoptions)

###### Returns

[`WriterSync`](#writersync)

###### Overrides

`AbstractWriterSync.constructor`

#### Properties

##### state

> `protected` **state**: `number`

Defined in: stax-xml-sync/dist/index.d.ts:98

###### Inherited from

`AbstractWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[]

Defined in: stax-xml-sync/dist/index.d.ts:99

###### Inherited from

`AbstractWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[]

Defined in: stax-xml-sync/dist/index.d.ts:100

###### Inherited from

`AbstractWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[]

Defined in: stax-xml-sync/dist/index.d.ts:101

###### Inherited from

`AbstractWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[]

Defined in: stax-xml-sync/dist/index.d.ts:102

###### Inherited from

`AbstractWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`WriterSyncOptions`](#writersyncoptions)\>

Defined in: stax-xml-sync/dist/index.d.ts:103

###### Inherited from

`AbstractWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number`

Defined in: stax-xml-sync/dist/index.d.ts:104

###### Inherited from

`AbstractWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean`

Defined in: stax-xml-sync/dist/index.d.ts:105

###### Inherited from

`AbstractWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: stax-xml-sync/dist/index.d.ts:106

###### Inherited from

`AbstractWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:114

Writes the XML declaration (e.g., <?xml version="1.0" encoding="UTF-8"?>).

###### Parameters

###### version?

`string`

###### encoding?

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeStartDocument`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: stax-xml-sync/dist/index.d.ts:118

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Inherited from

`AbstractWriterSync.writeEndDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:119

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

Defined in: stax-xml-sync/dist/index.d.ts:120

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

Defined in: stax-xml-sync/dist/index.d.ts:121

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

Defined in: stax-xml-sync/dist/index.d.ts:122

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:123

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:124

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:125

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

Defined in: stax-xml-sync/dist/index.d.ts:126

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: stax-xml-sync/dist/index.d.ts:127

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:128

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:129

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: stax-xml-sync/dist/index.d.ts:130

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: stax-xml-sync/dist/index.d.ts:131

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: stax-xml-sync/dist/index.d.ts:135

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: stax-xml-sync/dist/index.d.ts:137

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._writeNewline`

##### getXmlString()

> **getXmlString**(): `string`

Defined in: stax-xml-sync/dist/index.d.ts:147

###### Returns

`string`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: stax-xml-sync/dist/index.d.ts:148

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractWriterSync._emit`

***

### WriterSyncSink

Defined in: stax-xml-sync/dist/index.d.ts:153

Sink-based sync writer. Use this for file/buffer incremental writes.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSyncSink**(`sink`, `options?`): [`WriterSyncSink`](#writersyncsink)

Defined in: stax-xml-sync/dist/index.d.ts:160

###### Parameters

###### sink

[`SyncTextSink`](#synctextsink)

###### options?

[`WriterSyncSinkOptions`](#writersyncsinkoptions)

###### Returns

[`WriterSyncSink`](#writersyncsink)

###### Overrides

`AbstractWriterSync.constructor`

#### Properties

##### state

> `protected` **state**: `number`

Defined in: stax-xml-sync/dist/index.d.ts:98

###### Inherited from

`AbstractWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[]

Defined in: stax-xml-sync/dist/index.d.ts:99

###### Inherited from

`AbstractWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[]

Defined in: stax-xml-sync/dist/index.d.ts:100

###### Inherited from

`AbstractWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[]

Defined in: stax-xml-sync/dist/index.d.ts:101

###### Inherited from

`AbstractWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[]

Defined in: stax-xml-sync/dist/index.d.ts:102

###### Inherited from

`AbstractWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`WriterSyncOptions`](#writersyncoptions)\>

Defined in: stax-xml-sync/dist/index.d.ts:103

###### Inherited from

`AbstractWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number`

Defined in: stax-xml-sync/dist/index.d.ts:104

###### Inherited from

`AbstractWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean`

Defined in: stax-xml-sync/dist/index.d.ts:105

###### Inherited from

`AbstractWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: stax-xml-sync/dist/index.d.ts:106

###### Inherited from

`AbstractWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:114

Writes the XML declaration (e.g., <?xml version="1.0" encoding="UTF-8"?>).

###### Parameters

###### version?

`string`

###### encoding?

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeStartDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:119

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

Defined in: stax-xml-sync/dist/index.d.ts:120

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

Defined in: stax-xml-sync/dist/index.d.ts:121

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

Defined in: stax-xml-sync/dist/index.d.ts:122

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:123

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:124

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:125

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

Defined in: stax-xml-sync/dist/index.d.ts:126

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: stax-xml-sync/dist/index.d.ts:127

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:128

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: stax-xml-sync/dist/index.d.ts:129

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: stax-xml-sync/dist/index.d.ts:130

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: stax-xml-sync/dist/index.d.ts:131

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: stax-xml-sync/dist/index.d.ts:135

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: stax-xml-sync/dist/index.d.ts:137

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._writeNewline`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: stax-xml-sync/dist/index.d.ts:161

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractWriterSync._emit`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: stax-xml-sync/dist/index.d.ts:162

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Overrides

`AbstractWriterSync.writeEndDocument`

##### flush()

> **flush**(): `void`

Defined in: stax-xml-sync/dist/index.d.ts:163

###### Returns

`void`

##### close()

> **close**(): `void`

Defined in: stax-xml-sync/dist/index.d.ts:164

###### Returns

`void`

## Interfaces

### StreamReaderOptions

Defined in: stax-xml-async/dist/index.d.ts:5

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: stax-xml-async/dist/index.d.ts:6

***

### EventReaderOptions

Defined in: stax-xml-async/dist/index.d.ts:34

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: stax-xml-async/dist/index.d.ts:35

***

### WriterOptions

Defined in: stax-xml-async/dist/index.d.ts:52

Configuration options for the Writer

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: stax-xml-async/dist/index.d.ts:58

XML declaration encoding. Writer output is always UTF-8.
Values other than UTF-8 are rejected.

###### Default Value

```ts
'utf-8'
```

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: stax-xml-async/dist/index.d.ts:63

Whether to format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString?**: `string`

Defined in: stax-xml-async/dist/index.d.ts:68

String used for indentation when prettyPrint is true

###### Default Value

```ts
'  '
```

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: stax-xml-async/dist/index.d.ts:73

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

Defined in: stax-xml-async/dist/index.d.ts:81

Whether to automatically encode XML entities

###### Default Value

```ts
true
```

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: stax-xml-async/dist/index.d.ts:86

Internal buffer size in bytes

###### Default Value

```ts
16384
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: stax-xml-async/dist/index.d.ts:91

Automatic flush threshold (percentage of bufferSize)

###### Default Value

```ts
0.8
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: stax-xml-async/dist/index.d.ts:96

Whether to enable automatic flushing

###### Default Value

```ts
true
```

***

### StartDocumentEvent

Defined in: stax-xml-core/dist/index.d.ts:24

Event fired when the document starts parsing

#### Properties

##### type

> **type**: `"START_DOCUMENT"`

Defined in: stax-xml-core/dist/index.d.ts:25

***

### EndDocumentEvent

Defined in: stax-xml-core/dist/index.d.ts:32

Event fired when the document ends parsing

#### Properties

##### type

> **type**: `"END_DOCUMENT"`

Defined in: stax-xml-core/dist/index.d.ts:33

***

### StartElementEvent

Defined in: stax-xml-core/dist/index.d.ts:40

Event fired when an XML element starts

#### Properties

##### type

> **type**: `"START_ELEMENT"`

Defined in: stax-xml-core/dist/index.d.ts:41

##### name

> **name**: `string`

Defined in: stax-xml-core/dist/index.d.ts:42

##### localName

> **localName**: `string`

Defined in: stax-xml-core/dist/index.d.ts:43

##### prefix

> **prefix**: `string`

Defined in: stax-xml-core/dist/index.d.ts:44

##### namespaceURI

> **namespaceURI**: `string`

Defined in: stax-xml-core/dist/index.d.ts:45

##### attributes

> **attributes**: [`EventAttribute`](#eventattribute)[]

Defined in: stax-xml-core/dist/index.d.ts:46

***

### EventAttribute

Defined in: stax-xml-core/dist/index.d.ts:48

#### Properties

##### name

> **name**: `string`

Defined in: stax-xml-core/dist/index.d.ts:49

##### localName

> **localName**: `string`

Defined in: stax-xml-core/dist/index.d.ts:50

##### prefix

> **prefix**: `string`

Defined in: stax-xml-core/dist/index.d.ts:51

##### namespaceURI

> **namespaceURI**: `string`

Defined in: stax-xml-core/dist/index.d.ts:52

##### value

> **value**: `string`

Defined in: stax-xml-core/dist/index.d.ts:53

***

### EndElementEvent

Defined in: stax-xml-core/dist/index.d.ts:55

#### Properties

##### type

> **type**: `"END_ELEMENT"`

Defined in: stax-xml-core/dist/index.d.ts:56

##### name

> **name**: `string`

Defined in: stax-xml-core/dist/index.d.ts:57

##### localName

> **localName**: `string`

Defined in: stax-xml-core/dist/index.d.ts:58

##### prefix

> **prefix**: `string`

Defined in: stax-xml-core/dist/index.d.ts:59

##### namespaceURI

> **namespaceURI**: `string`

Defined in: stax-xml-core/dist/index.d.ts:60

***

### CharactersEvent

Defined in: stax-xml-core/dist/index.d.ts:62

#### Properties

##### type

> **type**: `"CHARACTERS"`

Defined in: stax-xml-core/dist/index.d.ts:63

##### value

> **value**: `string`

Defined in: stax-xml-core/dist/index.d.ts:64

***

### CdataEvent

Defined in: stax-xml-core/dist/index.d.ts:66

#### Properties

##### type

> **type**: `"CDATA"`

Defined in: stax-xml-core/dist/index.d.ts:67

##### value

> **value**: `string`

Defined in: stax-xml-core/dist/index.d.ts:68

***

### CommentEvent

Defined in: stax-xml-core/dist/index.d.ts:70

#### Properties

##### type

> **type**: `"COMMENT"`

Defined in: stax-xml-core/dist/index.d.ts:71

##### value

> **value**: `string`

Defined in: stax-xml-core/dist/index.d.ts:72

***

### ProcessingInstructionEvent

Defined in: stax-xml-core/dist/index.d.ts:74

#### Properties

##### type

> **type**: `"PROCESSING_INSTRUCTION"`

Defined in: stax-xml-core/dist/index.d.ts:75

##### target

> **target**: `string`

Defined in: stax-xml-core/dist/index.d.ts:76

##### data

> **data**: `string`

Defined in: stax-xml-core/dist/index.d.ts:77

***

### DtdEvent

Defined in: stax-xml-core/dist/index.d.ts:79

#### Properties

##### type

> **type**: `"DTD"`

Defined in: stax-xml-core/dist/index.d.ts:80

##### value

> **value**: `string`

Defined in: stax-xml-core/dist/index.d.ts:81

***

### AttributeInfo

Defined in: stax-xml-core/dist/index.d.ts:90

Attribute information interface

#### Properties

##### value

> **value**: `string`

Defined in: stax-xml-core/dist/index.d.ts:91

##### localName

> **localName**: `string`

Defined in: stax-xml-core/dist/index.d.ts:92

##### prefix?

> `optional` **prefix?**: `string`

Defined in: stax-xml-core/dist/index.d.ts:93

##### uri?

> `optional` **uri?**: `string`

Defined in: stax-xml-core/dist/index.d.ts:94

***

### WriteElementOptions

Defined in: stax-xml-core/dist/index.d.ts:140

Element writing options interface (for Writer)

#### Properties

##### prefix?

> `optional` **prefix?**: `string`

Defined in: stax-xml-core/dist/index.d.ts:141

##### uri?

> `optional` **uri?**: `string`

Defined in: stax-xml-core/dist/index.d.ts:142

##### attributes?

> `optional` **attributes?**: `Record`\<`string`, `string` \| [`AttributeInfo`](#attributeinfo)\>

Defined in: stax-xml-core/dist/index.d.ts:143

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: stax-xml-core/dist/index.d.ts:144

##### comment?

> `optional` **comment?**: `string`

Defined in: stax-xml-core/dist/index.d.ts:145

***

### StreamReaderSyncOptions

Defined in: stax-xml-sync/dist/index.d.ts:5

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: stax-xml-sync/dist/index.d.ts:6

***

### EventReaderSyncOptions

Defined in: stax-xml-sync/dist/index.d.ts:33

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: stax-xml-sync/dist/index.d.ts:34

***

### SyncTextSink

Defined in: stax-xml-sync/dist/index.d.ts:50

Sink interface for custom sync targets.

#### Methods

##### write()

> **write**(`chunk`): `void`

Defined in: stax-xml-sync/dist/index.d.ts:51

###### Parameters

###### chunk

`string`

###### Returns

`void`

##### flush()?

> `optional` **flush**(): `void`

Defined in: stax-xml-sync/dist/index.d.ts:52

###### Returns

`void`

##### close()?

> `optional` **close**(): `void`

Defined in: stax-xml-sync/dist/index.d.ts:53

###### Returns

`void`

***

### WriterSyncOptions

Defined in: stax-xml-sync/dist/index.d.ts:58

Writer output options shared by string and sink variants.

#### Extended by

- [`WriterSyncSinkOptions`](#writersyncsinkoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: stax-xml-sync/dist/index.d.ts:60

XML declaration encoding. String output is not byte-encoded; only UTF-8 is accepted.

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: stax-xml-sync/dist/index.d.ts:61

##### indentString?

> `optional` **indentString?**: `string`

Defined in: stax-xml-sync/dist/index.d.ts:62

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: stax-xml-sync/dist/index.d.ts:63

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: stax-xml-sync/dist/index.d.ts:67

***

### WriterSyncSinkOptions

Defined in: stax-xml-sync/dist/index.d.ts:72

Writer options for sink-based sync mode.

#### Extends

- [`WriterSyncOptions`](#writersyncoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: stax-xml-sync/dist/index.d.ts:60

XML declaration encoding. String output is not byte-encoded; only UTF-8 is accepted.

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`encoding`](#encoding-1)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: stax-xml-sync/dist/index.d.ts:61

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`prettyPrint`](#prettyprint-1)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: stax-xml-sync/dist/index.d.ts:62

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`indentString`](#indentstring-1)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: stax-xml-sync/dist/index.d.ts:63

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`addEntities`](#addentities-1)

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: stax-xml-sync/dist/index.d.ts:67

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`autoEncodeEntities`](#autoencodeentities-1)

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: stax-xml-sync/dist/index.d.ts:77

Internal character buffer size.

###### Default Value

```ts
16384
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: stax-xml-sync/dist/index.d.ts:82

Emit buffered chunks automatically when threshold is reached.

###### Default Value

```ts
true
```

##### flushOnClose?

> `optional` **flushOnClose?**: `boolean`

Defined in: stax-xml-sync/dist/index.d.ts:87

Whether to call sink.flush() when the writer is finalized.

###### Default Value

```ts
false
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: stax-xml-sync/dist/index.d.ts:93

Flush threshold (percentage or absolute char count).
If <= 1, treated as percentage of bufferSize. Otherwise absolute char count.

###### Default Value

```ts
0.8
```

## Type Aliases

### StreamReaderSource

> **StreamReaderSource** = `AsyncIterable`\<`Uint8Array`\> \| `ReadableStream`\<`Uint8Array`\>

Defined in: stax-xml-async/dist/index.d.ts:4

***

### XmlEventType

> **XmlEventType** = *typeof* [`XmlEventType`](#xmleventtype)\[keyof *typeof* [`XmlEventType`](#xmleventtype)\]

Defined in: stax-xml-core/dist/index.d.ts:7

Enumeration of XML stream event types used by the StAX parser

***

### AnyXmlEvent

> **AnyXmlEvent** = [`StartDocumentEvent`](#startdocumentevent) \| [`EndDocumentEvent`](#enddocumentevent) \| [`StartElementEvent`](#startelementevent) \| [`EndElementEvent`](#endelementevent) \| [`CharactersEvent`](#charactersevent) \| [`CdataEvent`](#cdataevent) \| [`CommentEvent`](#commentevent) \| [`ProcessingInstructionEvent`](#processinginstructionevent) \| [`DtdEvent`](#dtdevent)

Defined in: stax-xml-core/dist/index.d.ts:86

Discriminated Union type for developer use

***

### DocumentMode

> **DocumentMode** = `"fragment"` \| `"document"`

Defined in: stax-xml-core/dist/index.d.ts:157

XML document conformance mode.

***

### StreamReaderSyncInput

> **StreamReaderSyncInput** = `string` \| `Uint8Array` \| `Iterable`\<`Uint8Array`\>

Defined in: stax-xml-sync/dist/index.d.ts:4

## Variables

### XmlEventType

> `const` **XmlEventType**: `object`

Defined in: stax-xml-core/dist/index.d.ts:7

Enumeration of XML stream event types used by the StAX parser

#### Type Declaration

##### START\_DOCUMENT

> `readonly` **START\_DOCUMENT**: `"START_DOCUMENT"`

##### END\_DOCUMENT

> `readonly` **END\_DOCUMENT**: `"END_DOCUMENT"`

##### START\_ELEMENT

> `readonly` **START\_ELEMENT**: `"START_ELEMENT"`

##### END\_ELEMENT

> `readonly` **END\_ELEMENT**: `"END_ELEMENT"`

##### CHARACTERS

> `readonly` **CHARACTERS**: `"CHARACTERS"`

##### CDATA

> `readonly` **CDATA**: `"CDATA"`

##### COMMENT

> `readonly` **COMMENT**: `"COMMENT"`

##### PROCESSING\_INSTRUCTION

> `readonly` **PROCESSING\_INSTRUCTION**: `"PROCESSING_INSTRUCTION"`

##### DTD

> `readonly` **DTD**: `"DTD"`

## Functions

### isStartElement()

> **isStartElement**(`event`): `event is StartElementEvent`

Defined in: stax-xml-core/dist/index.d.ts:101

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

Defined in: stax-xml-core/dist/index.d.ts:107

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

Defined in: stax-xml-core/dist/index.d.ts:113

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

Defined in: stax-xml-core/dist/index.d.ts:119

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

Defined in: stax-xml-core/dist/index.d.ts:130

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

Defined in: stax-xml-core/dist/index.d.ts:136

Type guard function - Check if the event is an END_DOCUMENT event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is EndDocumentEvent`

true if the event is an END_DOCUMENT event, false otherwise
