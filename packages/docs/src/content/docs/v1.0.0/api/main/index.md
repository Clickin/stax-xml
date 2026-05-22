---
title: stax-xml
description: API reference for stax-xml
slug: v1.0.0/api/main
---

**stax-xml**

***

# stax-xml

## Classes

### EventReader

Defined in: [packages/stax-xml/src/EventReader.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L30)

Event-object adapter over the batch-first async stream core.

#### Implements

- `AsyncIterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReader**(`xmlStream`, `options?`): [`EventReader`](#eventreader)

Defined in: [packages/stax-xml/src/EventReader.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L33)

###### Parameters

###### xmlStream

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

[`EventReaderOptions`](#eventreaderoptions) = `{}`

###### Returns

[`EventReader`](#eventreader)

#### Accessors

##### XmlEventType

###### Get Signature

> **get** **XmlEventType**(): `object`

Defined in: [packages/stax-xml/src/EventReader.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L79)

###### Returns

`object`

###### START\_DOCUMENT

> `readonly` **START\_DOCUMENT**: `"START_DOCUMENT"` = `'START_DOCUMENT'`

###### END\_DOCUMENT

> `readonly` **END\_DOCUMENT**: `"END_DOCUMENT"` = `'END_DOCUMENT'`

###### START\_ELEMENT

> `readonly` **START\_ELEMENT**: `"START_ELEMENT"` = `'START_ELEMENT'`

###### END\_ELEMENT

> `readonly` **END\_ELEMENT**: `"END_ELEMENT"` = `'END_ELEMENT'`

###### CHARACTERS

> `readonly` **CHARACTERS**: `"CHARACTERS"` = `'CHARACTERS'`

###### CDATA

> `readonly` **CDATA**: `"CDATA"` = `'CDATA'`

###### ERROR

> `readonly` **ERROR**: `"ERROR"` = `'ERROR'`

#### Methods

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [packages/stax-xml/src/EventReader.ts:54](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L54)

###### Returns

`AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`AsyncIterable.[asyncIterator]`

##### next()

> **next**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: [packages/stax-xml/src/EventReader.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L63)

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.next`

##### return()

> **return**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: [packages/stax-xml/src/EventReader.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L67)

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.return`

##### nextBatch()

> **nextBatch**(): `Promise`\<[`AnyXmlEvent`](#anyxmlevent)[] \| `null`\>

Defined in: [packages/stax-xml/src/EventReader.ts:71](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L71)

###### Returns

`Promise`\<[`AnyXmlEvent`](#anyxmlevent)[] \| `null`\>

##### batchedIterator()

> **batchedIterator**(): `AsyncGenerator`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

Defined in: [packages/stax-xml/src/EventReader.ts:75](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L75)

###### Returns

`AsyncGenerator`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

***

### EventReaderSync

Defined in: [packages/stax-xml/src/EventReaderSync.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L30)

Event-object adapter over the batch-first sync stream core.

#### Implements

- `Iterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReaderSync**(`xml`, `options?`): [`EventReaderSync`](#eventreadersync)

Defined in: [packages/stax-xml/src/EventReaderSync.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L43)

###### Parameters

###### xml

`string`

###### options?

[`EventReaderSyncOptions`](#eventreadersyncoptions) = `{}`

###### Returns

[`EventReaderSync`](#eventreadersync)

#### Methods

##### nextBatch()

> **nextBatch**(): [`AnyXmlEvent`](#anyxmlevent)[] \| `null`

Defined in: [packages/stax-xml/src/EventReaderSync.ts:75](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L75)

###### Returns

[`AnyXmlEvent`](#anyxmlevent)[] \| `null`

##### batchedIterator()

> **batchedIterator**(): `IterableIterator`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

Defined in: [packages/stax-xml/src/EventReaderSync.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L87)

###### Returns

`IterableIterator`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

##### \[iterator\]()

> **\[iterator\]**(): `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [packages/stax-xml/src/EventReaderSync.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L97)

###### Returns

`Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterable.[iterator]`

##### next()

> **next**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [packages/stax-xml/src/EventReaderSync.ts:101](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L101)

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.next`

##### return()

> **return**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [packages/stax-xml/src/EventReaderSync.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L116)

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.return`

***

### StreamReader

Defined in: [packages/stax-xml/src/StreamReader.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReader.ts#L36)

Batch-first asynchronous StAX core over `ReadableStream<Uint8Array>`.

#### Implements

- `AsyncIterable`\<[`StreamBatch`](#streambatch)\>

#### Constructors

##### Constructor

> **new StreamReader**(`stream`, `options?`): [`StreamReader`](#streamreader)

Defined in: [packages/stax-xml/src/StreamReader.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReader.ts#L45)

###### Parameters

###### stream

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

[`StreamReaderOptions`](#streamreaderoptions) = `{}`

###### Returns

[`StreamReader`](#streamreader)

#### Methods

##### nextBatch()

> **nextBatch**(): `Promise`\<[`StreamBatch`](#streambatch) \| `null`\>

Defined in: [packages/stax-xml/src/StreamReader.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReader.ts#L57)

###### Returns

`Promise`\<[`StreamBatch`](#streambatch) \| `null`\>

##### return()

> **return**(): `Promise`\<`void`\>

Defined in: [packages/stax-xml/src/StreamReader.ts:76](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReader.ts#L76)

###### Returns

`Promise`\<`void`\>

##### batchedIterator()

> **batchedIterator**(): `AsyncGenerator`\<[`StreamBatch`](#streambatch)\>

Defined in: [packages/stax-xml/src/StreamReader.ts:89](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReader.ts#L89)

###### Returns

`AsyncGenerator`\<[`StreamBatch`](#streambatch)\>

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `AsyncGenerator`\<[`StreamBatch`](#streambatch)\>

Defined in: [packages/stax-xml/src/StreamReader.ts:105](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReader.ts#L105)

###### Returns

`AsyncGenerator`\<[`StreamBatch`](#streambatch)\>

###### Implementation of

`AsyncIterable.[asyncIterator]`

##### currentGeneration()

> **currentGeneration**(): `number`

Defined in: [packages/stax-xml/src/StreamReader.ts:109](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReader.ts#L109)

###### Returns

`number`

***

### StreamReaderSync

Defined in: [packages/stax-xml/src/StreamReaderSync.ts:41](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReaderSync.ts#L41)

Batch-first synchronous StAX core over bytes.

#### Implements

- `Iterable`\<[`StreamBatch`](#streambatch)\>

#### Constructors

##### Constructor

> **new StreamReaderSync**(`source`, `options?`): [`StreamReaderSync`](#streamreadersync)

Defined in: [packages/stax-xml/src/StreamReaderSync.ts:46](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReaderSync.ts#L46)

###### Parameters

###### source

`Iterable`\<[`StreamReaderSyncByteBatch`](#streamreadersyncbytebatch)\>

###### options?

[`StreamReaderSyncOptions`](#streamreadersyncoptions)

###### Returns

[`StreamReaderSync`](#streamreadersync)

##### Constructor

> **new StreamReaderSync**(`source`, `options?`): [`StreamReaderSync`](#streamreadersync)

Defined in: [packages/stax-xml/src/StreamReaderSync.ts:47](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReaderSync.ts#L47)

###### Parameters

###### source

`Uint8Array`

###### options?

[`StreamReaderSyncOptions`](#streamreadersyncoptions)

###### Returns

[`StreamReaderSync`](#streamreadersync)

#### Methods

##### nextBatch()

> **nextBatch**(): [`StreamBatch`](#streambatch) \| `null`

Defined in: [packages/stax-xml/src/StreamReaderSync.ts:59](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReaderSync.ts#L59)

###### Returns

[`StreamBatch`](#streambatch) \| `null`

##### nextRawBatch()

> **nextRawBatch**(): [`StreamReaderSyncRawBatch`](#streamreadersyncrawbatch) \| `null`

Defined in: [packages/stax-xml/src/StreamReaderSync.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReaderSync.ts#L81)

**`Experimental`**

Return an experimental low-level batch view without creating per-event
wrapper objects.

This API is intended for benchmark and scanner-style traversal paths. The
existing [nextBatch](#nextbatch-3) API remains the stable ergonomic surface.

###### Returns

[`StreamReaderSyncRawBatch`](#streamreadersyncrawbatch) \| `null`

##### batchedIterator()

> **batchedIterator**(): `IterableIterator`\<[`StreamBatch`](#streambatch)\>

Defined in: [packages/stax-xml/src/StreamReaderSync.ts:113](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReaderSync.ts#L113)

###### Returns

`IterableIterator`\<[`StreamBatch`](#streambatch)\>

##### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<[`StreamBatch`](#streambatch)\>

Defined in: [packages/stax-xml/src/StreamReaderSync.ts:123](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReaderSync.ts#L123)

###### Returns

`IterableIterator`\<[`StreamBatch`](#streambatch)\>

###### Implementation of

`Iterable.[iterator]`

##### currentGeneration()

> **currentGeneration**(): `number`

Defined in: [packages/stax-xml/src/StreamReaderSync.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReaderSync.ts#L127)

###### Returns

`number`

***

### Writer

Defined in: [packages/stax-xml/src/Writer.ts:131](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L131)

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

Defined in: [packages/stax-xml/src/Writer.ts:170](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L170)

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

Defined in: [packages/stax-xml/src/Writer.ts:292](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L292)

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

Defined in: [packages/stax-xml/src/Writer.ts:317](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L317)

End document (automatically close all elements)

###### Returns

`Promise`\<`void`\>

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `Promise`\<[`Writer`](#writer)\>

Defined in: [packages/stax-xml/src/Writer.ts:338](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L338)

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

Defined in: [packages/stax-xml/src/Writer.ts:430](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L430)

Write end element

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCharacters()

> **writeCharacters**(`text`): `Promise`\<[`Writer`](#writer)\>

Defined in: [packages/stax-xml/src/Writer.ts:463](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L463)

Write text

###### Parameters

###### text

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCData()

> **writeCData**(`cdata`): `Promise`\<[`Writer`](#writer)\>

Defined in: [packages/stax-xml/src/Writer.ts:485](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L485)

Write CDATA section

###### Parameters

###### cdata

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeComment()

> **writeComment**(`comment`): `Promise`\<[`Writer`](#writer)\>

Defined in: [packages/stax-xml/src/Writer.ts:505](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L505)

Write comment

###### Parameters

###### comment

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeRaw()

> **writeRaw**(`xml`): `Promise`\<[`Writer`](#writer)\>

Defined in: [packages/stax-xml/src/Writer.ts:528](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L528)

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

Defined in: [packages/stax-xml/src/Writer.ts:537](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L537)

Manual flush

###### Returns

`Promise`\<`void`\>

##### getMetrics()

> **getMetrics**(): `object`

Defined in: [packages/stax-xml/src/Writer.ts:544](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L544)

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

### WriterSync

Defined in: [packages/stax-xml/src/WriterSync.ts:493](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L493)

String-based sync writer.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSync**(`options?`): [`WriterSync`](#writersync)

Defined in: [packages/stax-xml/src/WriterSync.ts:496](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L496)

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

Defined in: [packages/stax-xml/src/WriterSync.ts:78](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L78)

###### Inherited from

`AbstractWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[] = `[]`

Defined in: [packages/stax-xml/src/WriterSync.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L79)

###### Inherited from

`AbstractWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[] = `[]`

Defined in: [packages/stax-xml/src/WriterSync.ts:80](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L80)

###### Inherited from

`AbstractWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[] = `[]`

Defined in: [packages/stax-xml/src/WriterSync.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L81)

###### Inherited from

`AbstractWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[] = `[]`

Defined in: [packages/stax-xml/src/WriterSync.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L82)

###### Inherited from

`AbstractWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`WriterSyncOptions`](#writersyncoptions)\>

Defined in: [packages/stax-xml/src/WriterSync.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L83)

###### Inherited from

`AbstractWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number` = `0`

Defined in: [packages/stax-xml/src/WriterSync.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L84)

###### Inherited from

`AbstractWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean` = `false`

Defined in: [packages/stax-xml/src/WriterSync.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L85)

###### Inherited from

`AbstractWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: [packages/stax-xml/src/WriterSync.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L86)

###### Inherited from

`AbstractWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:133](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L133)

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

Defined in: [packages/stax-xml/src/WriterSync.ts:158](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L158)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Inherited from

`AbstractWriterSync.writeEndDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:170](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L170)

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

Defined in: [packages/stax-xml/src/WriterSync.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L249)

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

Defined in: [packages/stax-xml/src/WriterSync.ts:259](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L259)

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

Defined in: [packages/stax-xml/src/WriterSync.ts:276](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L276)

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:290](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L290)

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:307](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L307)

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:322](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L322)

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

Defined in: [packages/stax-xml/src/WriterSync.ts:344](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L344)

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:350](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L350)

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:382](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L382)

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:387](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L387)

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [packages/stax-xml/src/WriterSync.ts:393](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L393)

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [packages/stax-xml/src/WriterSync.ts:397](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L397)

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: [packages/stax-xml/src/WriterSync.ts:419](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L419)

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: [packages/stax-xml/src/WriterSync.ts:437](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L437)

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._writeNewline`

##### getXmlString()

> **getXmlString**(): `string`

Defined in: [packages/stax-xml/src/WriterSync.ts:500](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L500)

###### Returns

`string`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: [packages/stax-xml/src/WriterSync.ts:504](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L504)

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractWriterSync._emit`

***

### WriterSyncSink

Defined in: [packages/stax-xml/src/WriterSync.ts:512](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L512)

Sink-based sync writer. Use this for file/buffer incremental writes.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSyncSink**(`sink`, `options?`): [`WriterSyncSink`](#writersyncsink)

Defined in: [packages/stax-xml/src/WriterSync.ts:520](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L520)

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

Defined in: [packages/stax-xml/src/WriterSync.ts:78](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L78)

###### Inherited from

`AbstractWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[] = `[]`

Defined in: [packages/stax-xml/src/WriterSync.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L79)

###### Inherited from

`AbstractWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[] = `[]`

Defined in: [packages/stax-xml/src/WriterSync.ts:80](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L80)

###### Inherited from

`AbstractWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[] = `[]`

Defined in: [packages/stax-xml/src/WriterSync.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L81)

###### Inherited from

`AbstractWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[] = `[]`

Defined in: [packages/stax-xml/src/WriterSync.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L82)

###### Inherited from

`AbstractWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`WriterSyncOptions`](#writersyncoptions)\>

Defined in: [packages/stax-xml/src/WriterSync.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L83)

###### Inherited from

`AbstractWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number` = `0`

Defined in: [packages/stax-xml/src/WriterSync.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L84)

###### Inherited from

`AbstractWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean` = `false`

Defined in: [packages/stax-xml/src/WriterSync.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L85)

###### Inherited from

`AbstractWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: [packages/stax-xml/src/WriterSync.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L86)

###### Inherited from

`AbstractWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:133](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L133)

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

Defined in: [packages/stax-xml/src/WriterSync.ts:170](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L170)

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

Defined in: [packages/stax-xml/src/WriterSync.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L249)

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

Defined in: [packages/stax-xml/src/WriterSync.ts:259](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L259)

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

Defined in: [packages/stax-xml/src/WriterSync.ts:276](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L276)

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:290](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L290)

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:307](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L307)

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:322](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L322)

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

Defined in: [packages/stax-xml/src/WriterSync.ts:344](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L344)

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:350](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L350)

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:382](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L382)

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [packages/stax-xml/src/WriterSync.ts:387](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L387)

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [packages/stax-xml/src/WriterSync.ts:393](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L393)

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [packages/stax-xml/src/WriterSync.ts:397](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L397)

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: [packages/stax-xml/src/WriterSync.ts:419](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L419)

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: [packages/stax-xml/src/WriterSync.ts:437](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L437)

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._writeNewline`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: [packages/stax-xml/src/WriterSync.ts:536](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L536)

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractWriterSync._emit`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: [packages/stax-xml/src/WriterSync.ts:577](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L577)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Overrides

`AbstractWriterSync.writeEndDocument`

##### flush()

> **flush**(): `void`

Defined in: [packages/stax-xml/src/WriterSync.ts:585](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L585)

###### Returns

`void`

##### close()

> **close**(): `void`

Defined in: [packages/stax-xml/src/WriterSync.ts:592](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L592)

###### Returns

`void`

## Interfaces

### EventReaderOptions

Defined in: [packages/stax-xml/src/EventReader.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L16)

Asynchronous event reader options.

#### Properties

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [packages/stax-xml/src/EventReader.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L17)

##### addEntities?

> `optional` **addEntities?**: [`EntityDefinition`](#entitydefinition)[]

Defined in: [packages/stax-xml/src/EventReader.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L18)

##### eventFilter?

> `optional` **eventFilter?**: [`ParserEventFilter`](#parsereventfilter)

Defined in: [packages/stax-xml/src/EventReader.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L19)

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-6)

Defined in: [packages/stax-xml/src/EventReader.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L20)

##### namespaceAware?

> `optional` **namespaceAware?**: `boolean`

Defined in: [packages/stax-xml/src/EventReader.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L21)

##### maxChunkBytes?

> `optional` **maxChunkBytes?**: `number`

Defined in: [packages/stax-xml/src/EventReader.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L22)

***

### EventReaderSyncOptions

Defined in: [packages/stax-xml/src/EventReaderSync.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L17)

Synchronous event reader options.

#### Properties

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [packages/stax-xml/src/EventReaderSync.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L18)

##### addEntities?

> `optional` **addEntities?**: [`EntityDefinition`](#entitydefinition)[]

Defined in: [packages/stax-xml/src/EventReaderSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L19)

##### eventFilter?

> `optional` **eventFilter?**: [`ParserEventFilter`](#parsereventfilter)

Defined in: [packages/stax-xml/src/EventReaderSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L20)

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-6)

Defined in: [packages/stax-xml/src/EventReaderSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L21)

##### namespaceAware?

> `optional` **namespaceAware?**: `boolean`

Defined in: [packages/stax-xml/src/EventReaderSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReaderSync.ts#L22)

***

### EntityDefinition

Defined in: [packages/stax-xml/src/IterableEventBackend.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/IterableEventBackend.ts#L17)

#### Properties

##### entity

> **entity**: `string`

Defined in: [packages/stax-xml/src/IterableEventBackend.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/IterableEventBackend.ts#L18)

##### value

> **value**: `string`

Defined in: [packages/stax-xml/src/IterableEventBackend.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/IterableEventBackend.ts#L19)

***

### StreamReaderOptions

Defined in: [packages/stax-xml/src/StreamReader.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReader.ts#L15)

Asynchronous stream reader options.

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [packages/stax-xml/src/StreamReader.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReader.ts#L21)

Text encoding used when materializing text from byte batches.

###### Default Value

```ts
'utf-8'
```

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-6)

Defined in: [packages/stax-xml/src/StreamReader.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReader.ts#L28)

XML document conformance mode.

###### Default Value

```ts
'fragment'
```

***

### StreamReaderSyncOptions

Defined in: [packages/stax-xml/src/StreamReaderSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReaderSync.ts#L20)

Synchronous stream reader options.

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [packages/stax-xml/src/StreamReaderSync.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReaderSync.ts#L26)

Text encoding used when materializing text from byte batches.

###### Default Value

```ts
'utf-8'
```

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-6)

Defined in: [packages/stax-xml/src/StreamReaderSync.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StreamReaderSync.ts#L33)

XML document conformance mode.

###### Default Value

```ts
'fragment'
```

***

### WriterOptions

Defined in: [packages/stax-xml/src/Writer.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L20)

Configuration options for the Writer

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [packages/stax-xml/src/Writer.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L25)

Text encoding for the output stream

###### Default Value

```ts
'utf-8'
```

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [packages/stax-xml/src/Writer.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L31)

Whether to format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [packages/stax-xml/src/Writer.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L37)

String used for indentation when prettyPrint is true

###### Default Value

```ts
'  '
```

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [packages/stax-xml/src/Writer.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L43)

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

Defined in: [packages/stax-xml/src/Writer.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L49)

Whether to automatically encode XML entities

###### Default Value

```ts
true
```

##### namespaces?

> `optional` **namespaces?**: [`NamespaceDeclaration`](#namespacedeclaration)[]

Defined in: [packages/stax-xml/src/Writer.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L55)

Namespace declarations to include

###### Default Value

```ts
[]
```

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [packages/stax-xml/src/Writer.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L61)

Internal buffer size in bytes

###### Default Value

```ts
16384
```

##### highWaterMark?

> `optional` **highWaterMark?**: `number`

Defined in: [packages/stax-xml/src/Writer.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L67)

WritableStream backpressure threshold

###### Default Value

```ts
65536
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [packages/stax-xml/src/Writer.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L73)

Automatic flush threshold (percentage of bufferSize)

###### Default Value

```ts
0.8
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [packages/stax-xml/src/Writer.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L79)

Whether to enable automatic flushing

###### Default Value

```ts
true
```

***

### SyncTextSink

Defined in: [packages/stax-xml/src/WriterSync.ts:7](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L7)

Sink interface for custom sync targets.

#### Methods

##### write()

> **write**(`chunk`): `void`

Defined in: [packages/stax-xml/src/WriterSync.ts:8](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L8)

###### Parameters

###### chunk

`string`

###### Returns

`void`

##### flush()?

> `optional` **flush**(): `void`

Defined in: [packages/stax-xml/src/WriterSync.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L9)

###### Returns

`void`

##### close()?

> `optional` **close**(): `void`

Defined in: [packages/stax-xml/src/WriterSync.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L10)

###### Returns

`void`

***

### WriterSyncOptions

Defined in: [packages/stax-xml/src/WriterSync.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L16)

Writer output options shared by string and sink variants.

#### Extended by

- [`WriterSyncSinkOptions`](#writersyncsinkoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [packages/stax-xml/src/WriterSync.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L17)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [packages/stax-xml/src/WriterSync.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L18)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [packages/stax-xml/src/WriterSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L19)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [packages/stax-xml/src/WriterSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L20)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [packages/stax-xml/src/WriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L21)

##### namespaces?

> `optional` **namespaces?**: [`NamespaceDeclaration`](#namespacedeclaration)[]

Defined in: [packages/stax-xml/src/WriterSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L22)

***

### WriterSyncSinkOptions

Defined in: [packages/stax-xml/src/WriterSync.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L28)

Writer options for sink-based sync mode.

#### Extends

- [`WriterSyncOptions`](#writersyncoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [packages/stax-xml/src/WriterSync.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L17)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`encoding`](#encoding-3)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [packages/stax-xml/src/WriterSync.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L18)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`prettyPrint`](#prettyprint-1)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [packages/stax-xml/src/WriterSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L19)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`indentString`](#indentstring-1)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [packages/stax-xml/src/WriterSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L20)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`addEntities`](#addentities-3)

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [packages/stax-xml/src/WriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L21)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`autoEncodeEntities`](#autoencodeentities-1)

##### namespaces?

> `optional` **namespaces?**: [`NamespaceDeclaration`](#namespacedeclaration)[]

Defined in: [packages/stax-xml/src/WriterSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L22)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`namespaces`](#namespaces-1)

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [packages/stax-xml/src/WriterSync.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L33)

Internal character buffer size.

###### Default Value

```ts
16384
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [packages/stax-xml/src/WriterSync.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L39)

Emit buffered chunks automatically when threshold is reached.

###### Default Value

```ts
true
```

##### flushOnClose?

> `optional` **flushOnClose?**: `boolean`

Defined in: [packages/stax-xml/src/WriterSync.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L45)

Whether to call sink.flush() when the writer is finalized.

###### Default Value

```ts
false
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [packages/stax-xml/src/WriterSync.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L52)

Flush threshold (percentage or absolute char count).
If <= 1, treated as percentage of bufferSize. Otherwise absolute char count.

###### Default Value

```ts
0.8
```

***

### ParseXmlTreeOptions

Defined in: [packages/stax-xml/src/XmlObject.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L25)

Options shared by XML tree and compact object helper parsers.

#### Extended by

- [`ParseXmlObjectOptions`](#parsexmlobjectoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L26)

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-6)

Defined in: [packages/stax-xml/src/XmlObject.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L27)

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [packages/stax-xml/src/XmlObject.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L28)

##### addEntities?

> `optional` **addEntities?**: [`EntityDefinition`](#entitydefinition)[]

Defined in: [packages/stax-xml/src/XmlObject.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L29)

##### trimText?

> `optional` **trimText?**: `boolean`

Defined in: [packages/stax-xml/src/XmlObject.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L30)

##### batchSize?

> `optional` **batchSize?**: `number`

Defined in: [packages/stax-xml/src/XmlObject.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L31)

***

### ParseXmlObjectOptions

Defined in: [packages/stax-xml/src/XmlObject.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L35)

Options for compact object projection.

#### Extends

- [`ParseXmlTreeOptions`](#parsexmltreeoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L26)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`encoding`](#encoding-5)

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-6)

Defined in: [packages/stax-xml/src/XmlObject.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L27)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`documentMode`](#documentmode-4)

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [packages/stax-xml/src/XmlObject.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L28)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`autoDecodeEntities`](#autodecodeentities-2)

##### addEntities?

> `optional` **addEntities?**: [`EntityDefinition`](#entitydefinition)[]

Defined in: [packages/stax-xml/src/XmlObject.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L29)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`addEntities`](#addentities-5)

##### trimText?

> `optional` **trimText?**: `boolean`

Defined in: [packages/stax-xml/src/XmlObject.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L30)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`trimText`](#trimtext)

##### batchSize?

> `optional` **batchSize?**: `number`

Defined in: [packages/stax-xml/src/XmlObject.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L31)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`batchSize`](#batchsize)

##### attributePrefix?

> `optional` **attributePrefix?**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L37)

Prefix applied to XML attributes. Defaults to `@`, so `id` becomes `@id`.

##### textKey?

> `optional` **textKey?**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L39)

Key used for text in mixed-content objects. Defaults to `#text`.

##### cdataKey?

> `optional` **cdataKey?**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:41](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L41)

Key used for CDATA in compact objects. Defaults to `#cdata`.

##### alwaysArray?

> `optional` **alwaysArray?**: `boolean`

Defined in: [packages/stax-xml/src/XmlObject.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L43)

When true, element children are always represented as arrays.

***

### XmlTreeDocument

Defined in: [packages/stax-xml/src/XmlObject.ts:47](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L47)

Document wrapper returned by `parseXmlTree()` and `parseXmlTreeSync()`.

#### Properties

##### type

> **type**: `"document"`

Defined in: [packages/stax-xml/src/XmlObject.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L48)

##### children

> **children**: [`XmlTreeNode`](#xmltreenode)[]

Defined in: [packages/stax-xml/src/XmlObject.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L49)

***

### XmlTreeElement

Defined in: [packages/stax-xml/src/XmlObject.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L55)

Order-preserving XML element node.

#### Properties

##### type

> **type**: `"element"`

Defined in: [packages/stax-xml/src/XmlObject.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L56)

##### name

> **name**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L57)

##### attributes

> **attributes**: [`XmlObjectRecord`](#xmlobjectrecord)\<`string`\>

Defined in: [packages/stax-xml/src/XmlObject.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L58)

##### children

> **children**: [`XmlTreeNode`](#xmltreenode)[]

Defined in: [packages/stax-xml/src/XmlObject.ts:59](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L59)

***

### XmlTreeText

Defined in: [packages/stax-xml/src/XmlObject.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L63)

Text node in an order-preserving XML tree.

#### Properties

##### type

> **type**: `"text"`

Defined in: [packages/stax-xml/src/XmlObject.ts:64](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L64)

##### value

> **value**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:65](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L65)

***

### XmlTreeCdata

Defined in: [packages/stax-xml/src/XmlObject.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L69)

CDATA node in an order-preserving XML tree.

#### Properties

##### type

> **type**: `"cdata"`

Defined in: [packages/stax-xml/src/XmlObject.ts:70](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L70)

##### value

> **value**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:71](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L71)

***

### XmlObjectArray

Defined in: [packages/stax-xml/src/XmlObject.ts:78](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L78)

Array of compact object values used for repeated elements.

#### Extends

- `Array`\<[`XmlObjectValue`](#xmlobjectvalue)\>

#### Indexable

> \[`n`: `number`\]: [`XmlObjectValue`](#xmlobjectvalue)

***

### XmlObjectRecord

Defined in: [packages/stax-xml/src/XmlObject.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L81)

Null-prototype record used by tree attributes and compact object nodes.

#### Type Parameters

##### T

`T` = [`XmlObjectValue`](#xmlobjectvalue)

#### Indexable

> \[`key`: `string`\]: `T`

***

### StreamEventView

Defined in: [packages/stax-xml/src/stream-reader-core.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L34)

Batch-local event view.

#### Properties

##### type

> `readonly` **type**: [`StreamEventType`](#streameventtype-1)

Defined in: [packages/stax-xml/src/stream-reader-core.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L35)

#### Methods

##### name()

> **name**(): `string` \| `undefined`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L36)

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L37)

###### Returns

`string` \| `undefined`

##### getAttributeCount()

> **getAttributeCount**(): `number`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L38)

###### Returns

`number`

##### getAttributeName()

> **getAttributeName**(`index`): `string` \| `undefined`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L39)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributeValue()

> **getAttributeValue**(`indexOrName`): `string` \| `undefined`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:40](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L40)

###### Parameters

###### indexOrName

`string` \| `number`

###### Returns

`string` \| `undefined`

***

### StreamBatch

Defined in: [packages/stax-xml/src/stream-reader-core.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L48)

Batch view exposed by stream readers.

#### Extends

- `Iterable`\<[`StreamEventView`](#streameventview)\>

#### Properties

##### eventCount

> `readonly` **eventCount**: `number`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L49)

#### Methods

##### event()

> **event**(`index`): [`StreamEventView`](#streameventview)

Defined in: [packages/stax-xml/src/stream-reader-core.ts:50](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L50)

###### Parameters

###### index

`number`

###### Returns

[`StreamEventView`](#streameventview)

##### typeAt()

> **typeAt**(`index`): [`StreamEventType`](#streameventtype-1)

Defined in: [packages/stax-xml/src/stream-reader-core.ts:51](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L51)

###### Parameters

###### index

`number`

###### Returns

[`StreamEventType`](#streameventtype-1)

##### nameAt()

> **nameAt**(`index`): `string` \| `undefined`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L52)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### textAt()

> **textAt**(`index`): `string` \| `undefined`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L53)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeCountAt()

> **attributeCountAt**(`index`): `number`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:54](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L54)

###### Parameters

###### index

`number`

###### Returns

`number`

##### attributeNameAt()

> **attributeNameAt**(`eventIndex`, `attrIndex`): `string` \| `undefined`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L55)

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`string` \| `undefined`

##### attributeValueAt()

> **attributeValueAt**(`eventIndex`, `attrIndexOrName`): `string` \| `undefined`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L56)

###### Parameters

###### eventIndex

`number`

###### attrIndexOrName

`string` \| `number`

###### Returns

`string` \| `undefined`

***

### StartDocumentEvent

Defined in: [packages/stax-xml/src/types.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L48)

Event fired when the document starts parsing

#### Properties

##### type

> **type**: `"START_DOCUMENT"`

Defined in: [packages/stax-xml/src/types.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L49)

***

### EndDocumentEvent

Defined in: [packages/stax-xml/src/types.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L57)

Event fired when the document ends parsing

#### Properties

##### type

> **type**: `"END_DOCUMENT"`

Defined in: [packages/stax-xml/src/types.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L58)

***

### StartElementEvent

Defined in: [packages/stax-xml/src/types.ts:66](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L66)

Event fired when an XML element starts

#### Properties

##### type

> **type**: `"START_ELEMENT"`

Defined in: [packages/stax-xml/src/types.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L67)

##### name

> **name**: `string`

Defined in: [packages/stax-xml/src/types.ts:68](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L68)

##### localName?

> `optional` **localName?**: `string`

Defined in: [packages/stax-xml/src/types.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L69)

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [packages/stax-xml/src/types.ts:70](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L70)

##### uri?

> `optional` **uri?**: `string`

Defined in: [packages/stax-xml/src/types.ts:71](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L71)

##### attributes

> **attributes**: `Record`\<`string`, `string`\>

Defined in: [packages/stax-xml/src/types.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L72)

##### attributesWithPrefix?

> `optional` **attributesWithPrefix?**: `Record`\<`string`, [`AttributeInfo`](#attributeinfo)\>

Defined in: [packages/stax-xml/src/types.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L73)

***

### EndElementEvent

Defined in: [packages/stax-xml/src/types.ts:76](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L76)

#### Properties

##### type

> **type**: `"END_ELEMENT"`

Defined in: [packages/stax-xml/src/types.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L77)

##### name

> **name**: `string`

Defined in: [packages/stax-xml/src/types.ts:78](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L78)

##### localName?

> `optional` **localName?**: `string`

Defined in: [packages/stax-xml/src/types.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L79)

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [packages/stax-xml/src/types.ts:80](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L80)

##### uri?

> `optional` **uri?**: `string`

Defined in: [packages/stax-xml/src/types.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L81)

***

### CharactersEvent

Defined in: [packages/stax-xml/src/types.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L84)

#### Properties

##### type

> **type**: `"CHARACTERS"`

Defined in: [packages/stax-xml/src/types.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L85)

##### value

> **value**: `string`

Defined in: [packages/stax-xml/src/types.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L86)

***

### CdataEvent

Defined in: [packages/stax-xml/src/types.ts:89](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L89)

#### Properties

##### type

> **type**: `"CDATA"`

Defined in: [packages/stax-xml/src/types.ts:90](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L90)

##### value

> **value**: `string`

Defined in: [packages/stax-xml/src/types.ts:91](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L91)

***

### ErrorEvent

Defined in: [packages/stax-xml/src/types.ts:94](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L94)

#### Properties

##### type

> **type**: `"ERROR"`

Defined in: [packages/stax-xml/src/types.ts:95](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L95)

##### error

> **error**: `Error`

Defined in: [packages/stax-xml/src/types.ts:96](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L96)

***

### XmlAttribute

Defined in: [packages/stax-xml/src/types.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L114)

Attribute interface (for Writer)

#### Properties

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [packages/stax-xml/src/types.ts:115](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L115)

##### localName

> **localName**: `string`

Defined in: [packages/stax-xml/src/types.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L116)

##### uri?

> `optional` **uri?**: `string`

Defined in: [packages/stax-xml/src/types.ts:117](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L117)

##### value

> **value**: `string`

Defined in: [packages/stax-xml/src/types.ts:118](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L118)

***

### NamespaceDeclaration

Defined in: [packages/stax-xml/src/types.ts:125](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L125)

Namespace declaration interface (for Writer)
Not used in this simple implementation.

#### Properties

##### prefix

> **prefix**: `string`

Defined in: [packages/stax-xml/src/types.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L126)

##### uri

> **uri**: `string`

Defined in: [packages/stax-xml/src/types.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L127)

***

### ProcessingInstruction

Defined in: [packages/stax-xml/src/types.ts:134](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L134)

Processing instruction (PI) interface (for Writer)
Not used in this simple implementation.

#### Properties

##### target

> **target**: `string`

Defined in: [packages/stax-xml/src/types.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L135)

##### data?

> `optional` **data?**: `string`

Defined in: [packages/stax-xml/src/types.ts:136](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L136)

***

### AttributeInfo

Defined in: [packages/stax-xml/src/types.ts:142](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L142)

Attribute information interface

#### Properties

##### value

> **value**: `string`

Defined in: [packages/stax-xml/src/types.ts:143](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L143)

##### localName

> **localName**: `string`

Defined in: [packages/stax-xml/src/types.ts:144](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L144)

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [packages/stax-xml/src/types.ts:145](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L145)

##### uri?

> `optional` **uri?**: `string`

Defined in: [packages/stax-xml/src/types.ts:146](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L146)

***

### WriteElementOptions

Defined in: [packages/stax-xml/src/types.ts:354](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L354)

Element writing options interface (for Writer)

#### Properties

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [packages/stax-xml/src/types.ts:355](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L355)

##### uri?

> `optional` **uri?**: `string`

Defined in: [packages/stax-xml/src/types.ts:356](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L356)

##### attributes?

> `optional` **attributes?**: `Record`\<`string`, `string` \| [`AttributeInfo`](#attributeinfo)\>

Defined in: [packages/stax-xml/src/types.ts:357](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L357)

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: [packages/stax-xml/src/types.ts:358](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L358)

##### comment?

> `optional` **comment?**: `string`

Defined in: [packages/stax-xml/src/types.ts:359](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L359)

***

### ParserEventFilter

Defined in: [packages/stax-xml/src/types.ts:362](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L362)

#### Properties

##### includeAttributes

> **includeAttributes**: `boolean`

Defined in: [packages/stax-xml/src/types.ts:363](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L363)

##### includeCharacters

> **includeCharacters**: `boolean`

Defined in: [packages/stax-xml/src/types.ts:364](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L364)

##### includeCdata

> **includeCdata**: `boolean`

Defined in: [packages/stax-xml/src/types.ts:365](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L365)

## Type Aliases

### XmlSyncInput

> **XmlSyncInput** = `string` \| `Uint8Array` \| `Iterable`\<`Uint8Array`\>

Defined in: [packages/stax-xml/src/XmlObject.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L19)

XML inputs that can be parsed without crossing an async boundary.

***

### XmlAsyncInput

> **XmlAsyncInput** = [`XmlSyncInput`](#xmlsyncinput) \| `AsyncIterable`\<`Uint8Array`\> \| `ReadableStream`\<`Uint8Array`\>

Defined in: [packages/stax-xml/src/XmlObject.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L22)

XML inputs accepted by the convenience tree/object helpers.

***

### XmlTreeNode

> **XmlTreeNode** = [`XmlTreeElement`](#xmltreeelement) \| [`XmlTreeText`](#xmltreetext) \| [`XmlTreeCdata`](#xmltreecdata)

Defined in: [packages/stax-xml/src/XmlObject.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L52)

***

### XmlObjectValue

> **XmlObjectValue** = `string` \| [`XmlObjectRecord`](#xmlobjectrecord) \| [`XmlObjectArray`](#xmlobjectarray)

Defined in: [packages/stax-xml/src/XmlObject.ts:75](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L75)

Value stored in the compact object projection.

***

### StreamEventType

> **StreamEventType** = *typeof* [`StreamEventType`](#streameventtype)\[keyof *typeof* [`StreamEventType`](#streameventtype)\]

Defined in: [packages/stax-xml/src/stream-reader-core.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L6)

Numeric XML stream event type.

***

### StreamReaderSyncByteBatch

> **StreamReaderSyncByteBatch** = readonly `Uint8Array`[]

Defined in: [packages/stax-xml/src/stream-reader-core.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L27)

One synchronous byte batch consumed by [StreamReaderSync](#streamreadersync).

***

### StreamReaderSyncRawBatch

> **StreamReaderSyncRawBatch** = `StreamReaderSyncWordTableBatch` \| `StreamReaderSyncFrameBatch` \| `StreamReaderSyncSoaStringArenaBatch`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L152)

**`Experimental`**

Experimental raw batch traversal view returned by
[StreamReaderSync.nextRawBatch](#nextrawbatch).

***

### XmlEventType

> **XmlEventType** = *typeof* [`XmlEventType`](#xmleventtype-1)\[keyof *typeof* [`XmlEventType`](#xmleventtype-1)\]

Defined in: [packages/stax-xml/src/types.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L6)

Enumeration of XML stream event types used by the StAX parser

***

### AnyXmlEvent

> **AnyXmlEvent** = [`StartDocumentEvent`](#startdocumentevent) \| [`EndDocumentEvent`](#enddocumentevent) \| [`StartElementEvent`](#startelementevent) \| [`EndElementEvent`](#endelementevent) \| [`CharactersEvent`](#charactersevent) \| [`CdataEvent`](#cdataevent) \| [`ErrorEvent`](#errorevent)

Defined in: [packages/stax-xml/src/types.ts:102](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L102)

Discriminated Union type for developer use

***

### DocumentMode

> **DocumentMode** = `"fragment"` \| `"document"`

Defined in: [packages/stax-xml/src/types.ts:373](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L373)

XML document conformance mode.

## Variables

### StreamEventType

> `const` **StreamEventType**: `object`

Defined in: [packages/stax-xml/src/stream-reader-core.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/stream-reader-core.ts#L6)

Event type constants exposed by stream readers.

#### Type Declaration

##### START\_DOCUMENT

> `readonly` **START\_DOCUMENT**: `0` = `0`

##### END\_DOCUMENT

> `readonly` **END\_DOCUMENT**: `1` = `1`

##### START\_ELEMENT

> `readonly` **START\_ELEMENT**: `2` = `2`

##### END\_ELEMENT

> `readonly` **END\_ELEMENT**: `3` = `3`

##### CHARACTERS

> `readonly` **CHARACTERS**: `4` = `4`

##### CDATA

> `readonly` **CDATA**: `5` = `5`

***

### XmlEventType

> `const` **XmlEventType**: `object`

Defined in: [packages/stax-xml/src/types.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L6)

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

##### ERROR

> `readonly` **ERROR**: `"ERROR"` = `'ERROR'`

## Functions

### createEventReader()

> **createEventReader**(`xmlStream`, `options?`): [`EventReader`](#eventreader)

Defined in: [packages/stax-xml/src/EventReader.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/EventReader.ts#L84)

#### Parameters

##### xmlStream

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### options?

[`EventReaderOptions`](#eventreaderoptions) = `{}`

#### Returns

[`EventReader`](#eventreader)

***

### parseXmlTreeSync()

> **parseXmlTreeSync**(`input`, `options?`): [`XmlTreeDocument`](#xmltreedocument)

Defined in: [packages/stax-xml/src/XmlObject.ts:91](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L91)

Parse XML into an order-preserving tree using a synchronous input.

#### Parameters

##### input

[`XmlSyncInput`](#xmlsyncinput)

##### options?

[`ParseXmlTreeOptions`](#parsexmltreeoptions) = `{}`

#### Returns

[`XmlTreeDocument`](#xmltreedocument)

***

### parseXmlTree()

> **parseXmlTree**(`input`, `options?`): `Promise`\<[`XmlTreeDocument`](#xmltreedocument)\>

Defined in: [packages/stax-xml/src/XmlObject.ts:96](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L96)

Parse XML into an order-preserving tree.

#### Parameters

##### input

[`XmlAsyncInput`](#xmlasyncinput)

##### options?

[`ParseXmlTreeOptions`](#parsexmltreeoptions) = `{}`

#### Returns

`Promise`\<[`XmlTreeDocument`](#xmltreedocument)\>

***

### parseXmlObjectSync()

> **parseXmlObjectSync**(`input`, `options?`): [`XmlObjectRecord`](#xmlobjectrecord)

Defined in: [packages/stax-xml/src/XmlObject.ts:104](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L104)

Parse XML into a compact JavaScript object using a synchronous input.

#### Parameters

##### input

[`XmlSyncInput`](#xmlsyncinput)

##### options?

[`ParseXmlObjectOptions`](#parsexmlobjectoptions) = `{}`

#### Returns

[`XmlObjectRecord`](#xmlobjectrecord)

***

### parseXmlObject()

> **parseXmlObject**(`input`, `options?`): `Promise`\<[`XmlObjectRecord`](#xmlobjectrecord)\<[`XmlObjectValue`](#xmlobjectvalue)\>\>

Defined in: [packages/stax-xml/src/XmlObject.ts:112](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L112)

Parse XML into a compact JavaScript object.

#### Parameters

##### input

[`XmlAsyncInput`](#xmlasyncinput)

##### options?

[`ParseXmlObjectOptions`](#parsexmlobjectoptions) = `{}`

#### Returns

`Promise`\<[`XmlObjectRecord`](#xmlobjectrecord)\<[`XmlObjectValue`](#xmlobjectvalue)\>\>

***

### isStartElement()

> **isStartElement**(`event`): `event is StartElementEvent`

Defined in: [packages/stax-xml/src/types.ts:297](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L297)

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

Defined in: [packages/stax-xml/src/types.ts:306](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L306)

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

Defined in: [packages/stax-xml/src/types.ts:315](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L315)

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

Defined in: [packages/stax-xml/src/types.ts:323](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L323)

Type guard function - Check if the event is a CDATA event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is CdataEvent`

true if the event is a CDATA event, false otherwise

***

### isError()

> **isError**(`event`): `event is ErrorEvent`

Defined in: [packages/stax-xml/src/types.ts:331](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L331)

Type guard function - Check if the event is an ERROR event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is ErrorEvent`

true if the event is an ERROR event, false otherwise

***

### isStartDocument()

> **isStartDocument**(`event`): `event is StartDocumentEvent`

Defined in: [packages/stax-xml/src/types.ts:339](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L339)

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

Defined in: [packages/stax-xml/src/types.ts:347](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L347)

Type guard function - Check if the event is an END_DOCUMENT event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is EndDocumentEvent`

true if the event is an END_DOCUMENT event, false otherwise

## References

### default

Renames and re-exports [WriterSync](#writersync)
