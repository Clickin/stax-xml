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

Defined in: [async/EventReader.ts:5](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L5)

#### Implements

- `AsyncIterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReader**(`input`, `options?`): [`EventReader`](#eventreader)

Defined in: [async/EventReader.ts:7](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L7)

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

Defined in: [async/EventReader.ts:8](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L8)

###### Returns

`AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`AsyncIterable.[asyncIterator]`

##### next()

> **next**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: [async/EventReader.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L9)

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.next`

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [async/EventReader.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L10)

###### Returns

`Promise`\<`void`\>

##### return()

> **return**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: [async/EventReader.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L11)

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.return`

***

### StreamReader

Defined in: [async/StreamReader.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L6)

#### Constructors

##### Constructor

> **new StreamReader**(`source`, `options?`): [`StreamReader`](#streamreader)

Defined in: [async/StreamReader.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L14)

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

Defined in: [async/StreamReader.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L20)

###### Returns

`Promise`\<[`XmlEventType`](#xmleventtype-1) \| `null`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [async/StreamReader.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L21)

###### Returns

`Promise`\<`void`\>

##### eventType()

> **eventType**(): [`XmlEventType`](#xmleventtype-1)

Defined in: [async/StreamReader.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L22)

###### Returns

[`XmlEventType`](#xmleventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: [async/StreamReader.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L23)

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [async/StreamReader.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L24)

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: [async/StreamReader.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L25)

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string`

Defined in: [async/StreamReader.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L26)

###### Returns

`string`

##### namespaceURI()

> **namespaceURI**(): `string`

Defined in: [async/StreamReader.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L27)

###### Returns

`string`

##### attributeCount()

> **attributeCount**(): `number`

Defined in: [async/StreamReader.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L28)

###### Returns

`number`

##### attributeName()

> **attributeName**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L29)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeLocalName()

> **attributeLocalName**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L30)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributePrefix()

> **attributePrefix**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L31)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeNamespaceURI()

> **attributeNamespaceURI**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L32)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeValue()

> **attributeValue**(`indexOrNameOrNamespace`, `localName?`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L33)

###### Parameters

###### indexOrNameOrNamespace

`string` \| `number`

###### localName?

`string`

###### Returns

`string` \| `undefined`

##### namespaceURIForPrefix()

> **namespaceURIForPrefix**(`prefix`): `string`

Defined in: [async/StreamReader.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L36)

###### Parameters

###### prefix

`string`

###### Returns

`string`

***

### Writer

Defined in: [async/Writer.ts:120](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L120)

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

Defined in: [async/Writer.ts:159](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L159)

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

Defined in: [async/Writer.ts:280](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L280)

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

Defined in: [async/Writer.ts:304](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L304)

End document (automatically close all elements)

###### Returns

`Promise`\<`void`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [async/Writer.ts:325](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L325)

Finalize any open elements, flush buffered bytes, and close the underlying stream.

###### Returns

`Promise`\<`void`\>

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:332](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L332)

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

Defined in: [async/Writer.ts:424](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L424)

Write end element

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCharacters()

> **writeCharacters**(`text`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:457](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L457)

Write text

###### Parameters

###### text

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCData()

> **writeCData**(`cdata`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:479](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L479)

Write CDATA section

###### Parameters

###### cdata

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeComment()

> **writeComment**(`comment`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:499](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L499)

Write comment

###### Parameters

###### comment

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeRaw()

> **writeRaw**(`xml`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:522](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L522)

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

Defined in: [async/Writer.ts:531](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L531)

Manual flush

###### Returns

`Promise`\<`void`\>

##### getMetrics()

> **getMetrics**(): `object`

Defined in: [async/Writer.ts:538](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L538)

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

Defined in: [sync/EventReaderSync.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L6)

#### Implements

- `Iterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReaderSync**(`input`, `options?`): [`EventReaderSync`](#eventreadersync)

Defined in: [sync/EventReaderSync.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L9)

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

Defined in: [sync/EventReaderSync.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L10)

###### Returns

`Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterable.[iterator]`

##### next()

> **next**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [sync/EventReaderSync.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L11)

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.next`

##### return()

> **return**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [sync/EventReaderSync.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L17)

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.return`

##### close()

> **close**(): `void`

Defined in: [sync/EventReaderSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L21)

###### Returns

`void`

***

### StreamReaderSync

Defined in: [sync/StreamReaderSync.ts:8](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L8)

Synchronous current-token reader. Strings are scanned directly without encoding.

#### Constructors

##### Constructor

> **new StreamReaderSync**(`input`, `options?`): [`StreamReaderSync`](#streamreadersync)

Defined in: [sync/StreamReaderSync.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L14)

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

Defined in: [sync/StreamReaderSync.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L28)

###### Returns

[`XmlEventType`](#xmleventtype-1) \| `null`

##### close()

> **close**(): `void`

Defined in: [sync/StreamReaderSync.ts:47](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L47)

###### Returns

`void`

##### eventType()

> **eventType**(): [`XmlEventType`](#xmleventtype-1)

Defined in: [sync/StreamReaderSync.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L55)

###### Returns

[`XmlEventType`](#xmleventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L56)

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L57)

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L58)

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string`

Defined in: [sync/StreamReaderSync.ts:59](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L59)

###### Returns

`string`

##### namespaceURI()

> **namespaceURI**(): `string`

Defined in: [sync/StreamReaderSync.ts:60](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L60)

###### Returns

`string`

##### attributeCount()

> **attributeCount**(): `number`

Defined in: [sync/StreamReaderSync.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L61)

###### Returns

`number`

##### attributeName()

> **attributeName**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L62)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeLocalName()

> **attributeLocalName**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L63)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributePrefix()

> **attributePrefix**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:64](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L64)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeNamespaceURI()

> **attributeNamespaceURI**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:65](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L65)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeValue()

> **attributeValue**(`indexOrNameOrNamespace`, `localName?`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:66](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L66)

###### Parameters

###### indexOrNameOrNamespace

`string` \| `number`

###### localName?

`string`

###### Returns

`string` \| `undefined`

##### namespaceURIForPrefix()

> **namespaceURIForPrefix**(`prefix`): `string`

Defined in: [sync/StreamReaderSync.ts:71](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L71)

###### Parameters

###### prefix

`string`

###### Returns

`string`

***

### WriterSync

Defined in: [sync/WriterSync.ts:486](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L486)

String-based sync writer.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSync**(`options?`): [`WriterSync`](#writersync)

Defined in: [sync/WriterSync.ts:489](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L489)

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

Defined in: [sync/WriterSync.ts:78](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L78)

###### Inherited from

`AbstractWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[] = `[]`

Defined in: [sync/WriterSync.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L79)

###### Inherited from

`AbstractWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[] = `[]`

Defined in: [sync/WriterSync.ts:80](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L80)

###### Inherited from

`AbstractWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[] = `[]`

Defined in: [sync/WriterSync.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L81)

###### Inherited from

`AbstractWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[] = `[]`

Defined in: [sync/WriterSync.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L82)

###### Inherited from

`AbstractWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`WriterSyncOptions`](#writersyncoptions)\>

Defined in: [sync/WriterSync.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L83)

###### Inherited from

`AbstractWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number` = `0`

Defined in: [sync/WriterSync.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L84)

###### Inherited from

`AbstractWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean` = `false`

Defined in: [sync/WriterSync.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L85)

###### Inherited from

`AbstractWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: [sync/WriterSync.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L86)

###### Inherited from

`AbstractWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: [sync/WriterSync.ts:133](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L133)

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

Defined in: [sync/WriterSync.ts:151](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L151)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Inherited from

`AbstractWriterSync.writeEndDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: [sync/WriterSync.ts:163](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L163)

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

Defined in: [sync/WriterSync.ts:242](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L242)

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

Defined in: [sync/WriterSync.ts:252](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L252)

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

Defined in: [sync/WriterSync.ts:269](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L269)

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [sync/WriterSync.ts:283](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L283)

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [sync/WriterSync.ts:300](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L300)

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [sync/WriterSync.ts:315](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L315)

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

Defined in: [sync/WriterSync.ts:337](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L337)

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [sync/WriterSync.ts:343](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L343)

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [sync/WriterSync.ts:375](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L375)

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [sync/WriterSync.ts:380](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L380)

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [sync/WriterSync.ts:386](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L386)

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [sync/WriterSync.ts:390](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L390)

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: [sync/WriterSync.ts:412](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L412)

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: [sync/WriterSync.ts:430](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L430)

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._writeNewline`

##### getXmlString()

> **getXmlString**(): `string`

Defined in: [sync/WriterSync.ts:493](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L493)

###### Returns

`string`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: [sync/WriterSync.ts:497](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L497)

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractWriterSync._emit`

***

### WriterSyncSink

Defined in: [sync/WriterSync.ts:505](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L505)

Sink-based sync writer. Use this for file/buffer incremental writes.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSyncSink**(`sink`, `options?`): [`WriterSyncSink`](#writersyncsink)

Defined in: [sync/WriterSync.ts:513](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L513)

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

Defined in: [sync/WriterSync.ts:78](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L78)

###### Inherited from

`AbstractWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[] = `[]`

Defined in: [sync/WriterSync.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L79)

###### Inherited from

`AbstractWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[] = `[]`

Defined in: [sync/WriterSync.ts:80](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L80)

###### Inherited from

`AbstractWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[] = `[]`

Defined in: [sync/WriterSync.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L81)

###### Inherited from

`AbstractWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[] = `[]`

Defined in: [sync/WriterSync.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L82)

###### Inherited from

`AbstractWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`WriterSyncOptions`](#writersyncoptions)\>

Defined in: [sync/WriterSync.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L83)

###### Inherited from

`AbstractWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number` = `0`

Defined in: [sync/WriterSync.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L84)

###### Inherited from

`AbstractWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean` = `false`

Defined in: [sync/WriterSync.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L85)

###### Inherited from

`AbstractWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: [sync/WriterSync.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L86)

###### Inherited from

`AbstractWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: [sync/WriterSync.ts:133](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L133)

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

Defined in: [sync/WriterSync.ts:163](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L163)

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

Defined in: [sync/WriterSync.ts:242](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L242)

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

Defined in: [sync/WriterSync.ts:252](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L252)

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

Defined in: [sync/WriterSync.ts:269](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L269)

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [sync/WriterSync.ts:283](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L283)

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [sync/WriterSync.ts:300](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L300)

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [sync/WriterSync.ts:315](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L315)

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

Defined in: [sync/WriterSync.ts:337](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L337)

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [sync/WriterSync.ts:343](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L343)

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [sync/WriterSync.ts:375](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L375)

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [sync/WriterSync.ts:380](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L380)

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [sync/WriterSync.ts:386](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L386)

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [sync/WriterSync.ts:390](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L390)

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: [sync/WriterSync.ts:412](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L412)

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: [sync/WriterSync.ts:430](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L430)

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._writeNewline`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: [sync/WriterSync.ts:529](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L529)

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractWriterSync._emit`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: [sync/WriterSync.ts:570](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L570)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Overrides

`AbstractWriterSync.writeEndDocument`

##### flush()

> **flush**(): `void`

Defined in: [sync/WriterSync.ts:578](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L578)

###### Returns

`void`

##### close()

> **close**(): `void`

Defined in: [sync/WriterSync.ts:585](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L585)

###### Returns

`void`

## Interfaces

### EventReaderOptions

Defined in: [async/EventReader.ts:4](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L4)

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [async/EventReader.ts:4](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L4)

***

### StreamReaderOptions

Defined in: [async/StreamReader.ts:4](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L4)

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [async/StreamReader.ts:4](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L4)

***

### WriterOptions

Defined in: [async/Writer.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L20)

Configuration options for the Writer

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [async/Writer.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L26)

XML declaration encoding. Writer output is always UTF-8.
Values other than UTF-8 are rejected.

###### Default Value

```ts
'utf-8'
```

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [async/Writer.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L32)

Whether to format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [async/Writer.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L38)

String used for indentation when prettyPrint is true

###### Default Value

```ts
'  '
```

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [async/Writer.ts:44](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L44)

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

Defined in: [async/Writer.ts:50](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L50)

Whether to automatically encode XML entities

###### Default Value

```ts
true
```

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [async/Writer.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L56)

Internal buffer size in bytes

###### Default Value

```ts
16384
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [async/Writer.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L62)

Automatic flush threshold (percentage of bufferSize)

###### Default Value

```ts
0.8
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [async/Writer.ts:68](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L68)

Whether to enable automatic flushing

###### Default Value

```ts
true
```

***

### StartDocumentEvent

Defined in: [core/types.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L25)

Event fired when the document starts parsing

#### Properties

##### type

> **type**: `"START_DOCUMENT"`

Defined in: [core/types.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L26)

***

### EndDocumentEvent

Defined in: [core/types.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L34)

Event fired when the document ends parsing

#### Properties

##### type

> **type**: `"END_DOCUMENT"`

Defined in: [core/types.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L35)

***

### StartElementEvent

Defined in: [core/types.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L43)

Event fired when an XML element starts

#### Properties

##### type

> **type**: `"START_ELEMENT"`

Defined in: [core/types.ts:44](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L44)

##### name

> **name**: `string`

Defined in: [core/types.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L45)

##### localName

> **localName**: `string`

Defined in: [core/types.ts:46](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L46)

##### prefix

> **prefix**: `string`

Defined in: [core/types.ts:47](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L47)

##### namespaceURI

> **namespaceURI**: `string`

Defined in: [core/types.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L48)

##### attributes

> **attributes**: [`EventAttribute`](#eventattribute)[]

Defined in: [core/types.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L49)

***

### EventAttribute

Defined in: [core/types.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L52)

#### Properties

##### name

> **name**: `string`

Defined in: [core/types.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L52)

##### localName

> **localName**: `string`

Defined in: [core/types.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L52)

##### prefix

> **prefix**: `string`

Defined in: [core/types.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L52)

##### namespaceURI

> **namespaceURI**: `string`

Defined in: [core/types.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L52)

##### value

> **value**: `string`

Defined in: [core/types.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L52)

***

### EndElementEvent

Defined in: [core/types.ts:54](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L54)

#### Properties

##### type

> **type**: `"END_ELEMENT"`

Defined in: [core/types.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L55)

##### name

> **name**: `string`

Defined in: [core/types.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L56)

##### localName

> **localName**: `string`

Defined in: [core/types.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L57)

##### prefix

> **prefix**: `string`

Defined in: [core/types.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L58)

##### namespaceURI

> **namespaceURI**: `string`

Defined in: [core/types.ts:59](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L59)

***

### CharactersEvent

Defined in: [core/types.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L62)

#### Properties

##### type

> **type**: `"CHARACTERS"`

Defined in: [core/types.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L63)

##### value

> **value**: `string`

Defined in: [core/types.ts:64](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L64)

***

### CdataEvent

Defined in: [core/types.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L67)

#### Properties

##### type

> **type**: `"CDATA"`

Defined in: [core/types.ts:68](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L68)

##### value

> **value**: `string`

Defined in: [core/types.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L69)

***

### CommentEvent

Defined in: [core/types.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L72)

#### Properties

##### type

> **type**: `"COMMENT"`

Defined in: [core/types.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L72)

##### value

> **value**: `string`

Defined in: [core/types.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L72)

***

### ProcessingInstructionEvent

Defined in: [core/types.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L73)

#### Properties

##### type

> **type**: `"PROCESSING_INSTRUCTION"`

Defined in: [core/types.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L73)

##### target

> **target**: `string`

Defined in: [core/types.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L73)

##### data

> **data**: `string`

Defined in: [core/types.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L73)

***

### DtdEvent

Defined in: [core/types.ts:74](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L74)

#### Properties

##### type

> **type**: `"DTD"`

Defined in: [core/types.ts:74](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L74)

##### value

> **value**: `string`

Defined in: [core/types.ts:74](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L74)

***

### AttributeInfo

Defined in: [core/types.ts:93](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L93)

Attribute information interface

#### Properties

##### value

> **value**: `string`

Defined in: [core/types.ts:94](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L94)

##### localName

> **localName**: `string`

Defined in: [core/types.ts:95](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L95)

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [core/types.ts:96](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L96)

##### uri?

> `optional` **uri?**: `string`

Defined in: [core/types.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L97)

***

### WriteElementOptions

Defined in: [core/types.ts:164](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L164)

Element writing options interface (for Writer)

#### Properties

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [core/types.ts:165](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L165)

##### uri?

> `optional` **uri?**: `string`

Defined in: [core/types.ts:166](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L166)

##### attributes?

> `optional` **attributes?**: `Record`\<`string`, `string` \| [`AttributeInfo`](#attributeinfo)\>

Defined in: [core/types.ts:167](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L167)

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: [core/types.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L168)

##### comment?

> `optional` **comment?**: `string`

Defined in: [core/types.ts:169](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L169)

***

### EventReaderSyncOptions

Defined in: [sync/EventReaderSync.ts:4](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L4)

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [sync/EventReaderSync.ts:4](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L4)

***

### StreamReaderSyncOptions

Defined in: [sync/StreamReaderSync.ts:4](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L4)

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [sync/StreamReaderSync.ts:4](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L4)

***

### SyncTextSink

Defined in: [sync/WriterSync.ts:7](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L7)

Sink interface for custom sync targets.

#### Methods

##### write()

> **write**(`chunk`): `void`

Defined in: [sync/WriterSync.ts:8](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L8)

###### Parameters

###### chunk

`string`

###### Returns

`void`

##### flush()?

> `optional` **flush**(): `void`

Defined in: [sync/WriterSync.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L9)

###### Returns

`void`

##### close()?

> `optional` **close**(): `void`

Defined in: [sync/WriterSync.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L10)

###### Returns

`void`

***

### WriterSyncOptions

Defined in: [sync/WriterSync.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L16)

Writer output options shared by string and sink variants.

#### Extended by

- [`WriterSyncSinkOptions`](#writersyncsinkoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [sync/WriterSync.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L18)

XML declaration encoding. String output is not byte-encoded; only UTF-8 is accepted.

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [sync/WriterSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L19)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [sync/WriterSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L20)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [sync/WriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L21)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [sync/WriterSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L22)

***

### WriterSyncSinkOptions

Defined in: [sync/WriterSync.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L28)

Writer options for sink-based sync mode.

#### Extends

- [`WriterSyncOptions`](#writersyncoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [sync/WriterSync.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L18)

XML declaration encoding. String output is not byte-encoded; only UTF-8 is accepted.

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`encoding`](#encoding-1)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [sync/WriterSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L19)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`prettyPrint`](#prettyprint-1)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [sync/WriterSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L20)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`indentString`](#indentstring-1)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [sync/WriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L21)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`addEntities`](#addentities-1)

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [sync/WriterSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L22)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`autoEncodeEntities`](#autoencodeentities-1)

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [sync/WriterSync.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L33)

Internal character buffer size.

###### Default Value

```ts
16384
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [sync/WriterSync.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L39)

Emit buffered chunks automatically when threshold is reached.

###### Default Value

```ts
true
```

##### flushOnClose?

> `optional` **flushOnClose?**: `boolean`

Defined in: [sync/WriterSync.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L45)

Whether to call sink.flush() when the writer is finalized.

###### Default Value

```ts
false
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [sync/WriterSync.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L52)

Flush threshold (percentage or absolute char count).
If <= 1, treated as percentage of bufferSize. Otherwise absolute char count.

###### Default Value

```ts
0.8
```

## Type Aliases

### StreamReaderSource

> **StreamReaderSource** = `AsyncIterable`\<`Uint8Array`\> \| `ReadableStream`\<`Uint8Array`\>

Defined in: [async/StreamReader.ts:3](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L3)

***

### XmlEventType

> **XmlEventType** = *typeof* [`XmlEventType`](#xmleventtype)\[keyof *typeof* [`XmlEventType`](#xmleventtype)\]

Defined in: [core/types.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L6)

Enumeration of XML stream event types used by the StAX parser

***

### AnyXmlEvent

> **AnyXmlEvent** = [`StartDocumentEvent`](#startdocumentevent) \| [`EndDocumentEvent`](#enddocumentevent) \| [`StartElementEvent`](#startelementevent) \| [`EndElementEvent`](#endelementevent) \| [`CharactersEvent`](#charactersevent) \| [`CdataEvent`](#cdataevent) \| [`CommentEvent`](#commentevent) \| [`ProcessingInstructionEvent`](#processinginstructionevent) \| [`DtdEvent`](#dtdevent)

Defined in: [core/types.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L79)

Discriminated Union type for developer use

***

### DocumentMode

> **DocumentMode** = `"fragment"` \| `"document"`

Defined in: [core/types.ts:183](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L183)

XML document conformance mode.

***

### StreamReaderSyncInput

> **StreamReaderSyncInput** = `string` \| `Uint8Array` \| `Iterable`\<`Uint8Array`\>

Defined in: [sync/StreamReaderSync.ts:3](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L3)

## Variables

### XmlEventType

> `const` **XmlEventType**: `object`

Defined in: [core/types.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L6)

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

Defined in: [core/types.ts:110](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L110)

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

Defined in: [core/types.ts:119](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L119)

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

Defined in: [core/types.ts:128](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L128)

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

Defined in: [core/types.ts:136](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L136)

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

Defined in: [core/types.ts:149](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L149)

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

Defined in: [core/types.ts:157](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L157)

Type guard function - Check if the event is an END_DOCUMENT event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is EndDocumentEvent`

true if the event is an END_DOCUMENT event, false otherwise
