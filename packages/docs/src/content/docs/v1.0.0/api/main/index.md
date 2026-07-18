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

Defined in: [async/EventReader.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L13)

Async iterator that yields stable, materialized XML event objects.

Use `StreamReader` instead when current-token access and lower allocation are
more important than retaining event objects.

#### Implements

- `AsyncIterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReader**(`input`, `options?`): [`EventReader`](#eventreader)

Defined in: [async/EventReader.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L15)

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

Defined in: [async/EventReader.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L17)

Return this reader as its async iterator.

###### Returns

`AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`AsyncIterable.[asyncIterator]`

##### next()

> **next**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: [async/EventReader.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L19)

Read the next materialized event.

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.next`

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [async/EventReader.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L21)

Stop parsing and close the underlying input iterator.

###### Returns

`Promise`\<`void`\>

##### return()

> **return**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: [async/EventReader.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L23)

Close the reader when async iteration ends early.

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.return`

***

### StreamReader

Defined in: [async/StreamReader.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L18)

Asynchronous, forward-only XML reader backed by a reusable token cursor.
Call `next()` before accessing the current token through the accessor methods.

#### Constructors

##### Constructor

> **new StreamReader**(`source`, `options?`): [`StreamReader`](#streamreader)

Defined in: [async/StreamReader.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L26)

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

Defined in: [async/StreamReader.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L34)

Advance to the next token, or return `null` at end of input.

###### Returns

`Promise`\<[`XmlEventType`](#xmleventtype-1) \| `null`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [async/StreamReader.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L36)

Stop parsing and close the underlying input iterator.

###### Returns

`Promise`\<`void`\>

##### eventType()

> **eventType**(): [`XmlEventType`](#xmleventtype-1)

Defined in: [async/StreamReader.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L38)

Return the current token type.

###### Returns

[`XmlEventType`](#xmleventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: [async/StreamReader.ts:40](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L40)

Return the current element's qualified name.

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [async/StreamReader.ts:42](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L42)

Return text carried by the current text-like token.

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: [async/StreamReader.ts:44](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L44)

Return the current element's local name.

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string`

Defined in: [async/StreamReader.ts:46](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L46)

Return the current element's namespace prefix, or an empty string.

###### Returns

`string`

##### namespaceURI()

> **namespaceURI**(): `string`

Defined in: [async/StreamReader.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L48)

Return the namespace URI resolved for the current element.

###### Returns

`string`

##### attributeCount()

> **attributeCount**(): `number`

Defined in: [async/StreamReader.ts:50](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L50)

Return the number of attributes on the current start element.

###### Returns

`number`

##### attributeName()

> **attributeName**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L52)

Return an attribute's qualified name by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeLocalName()

> **attributeLocalName**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:54](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L54)

Return an attribute's local name by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributePrefix()

> **attributePrefix**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L56)

Return an attribute's namespace prefix by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeNamespaceURI()

> **attributeNamespaceURI**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L58)

Return an attribute's namespace URI by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeValue()

> **attributeValue**(`indexOrNameOrNamespace`, `localName?`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:60](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L60)

Return an attribute value by index, qualified name, or namespace URI plus local name.

###### Parameters

###### indexOrNameOrNamespace

`string` \| `number`

###### localName?

`string`

###### Returns

`string` \| `undefined`

##### namespaceURIForPrefix()

> **namespaceURIForPrefix**(`prefix`): `string`

Defined in: [async/StreamReader.ts:64](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L64)

Resolve a namespace prefix in the current element scope.

###### Parameters

###### prefix

`string`

###### Returns

`string`

***

### Writer

Defined in: [async/Writer.ts:141](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L141)

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
await writer.writeStartElement('item', { attributes: { id: '1' } });
await writer.writeCharacters('Hello World');
await writer.writeEndElement();
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

> **new Writer**(`output`, `options?`): [`Writer`](#writer)

Defined in: [async/Writer.ts:186](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L186)

###### Parameters

###### output

[`AsyncTextSink`](#asynctextsink) \| `WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

[`WriterOptions`](#writeroptions) = `{}`

###### Returns

[`Writer`](#writer)

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:331](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L331)

Write XML declaration

###### Parameters

###### version?

`"1.0"` = `'1.0'`

###### encoding?

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeEndDocument()

> **writeEndDocument**(): `Promise`\<`void`\>

Defined in: [async/Writer.ts:356](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L356)

End document (automatically close all elements)

###### Returns

`Promise`\<`void`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [async/Writer.ts:387](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L387)

Finalize any open elements, flush buffered bytes, and close the underlying stream.

###### Returns

`Promise`\<`void`\>

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:394](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L394)

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

Defined in: [async/Writer.ts:450](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L450)

Write end element

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCharacters()

> **writeCharacters**(`text`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:486](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L486)

Write text

###### Parameters

###### text

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCData()

> **writeCData**(`cdata`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:509](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L509)

Write CDATA section

###### Parameters

###### cdata

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeComment()

> **writeComment**(`comment`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:531](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L531)

Write comment

###### Parameters

###### comment

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeRaw()

> **writeRaw**(`xml`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:556](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L556)

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

Defined in: [async/Writer.ts:566](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L566)

Manual flush

###### Returns

`Promise`\<`void`\>

##### getMetrics()

> **getMetrics**(): `object`

Defined in: [async/Writer.ts:582](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L582)

Return metrics

###### Returns

`object`

###### totalBytesWritten

> **totalBytesWritten**: `number` = `0`

###### totalCharactersWritten

> **totalCharactersWritten**: `number` = `0`

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

Defined in: [sync/EventReaderSync.ts:8](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L8)

Synchronous iterator that yields stable, materialized XML event objects.

#### Implements

- `Iterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReaderSync**(`input`, `options?`): [`EventReaderSync`](#eventreadersync)

Defined in: [sync/EventReaderSync.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L11)

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

Defined in: [sync/EventReaderSync.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L13)

Return this reader as its iterator.

###### Returns

`Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterable.[iterator]`

##### next()

> **next**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [sync/EventReaderSync.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L15)

Read the next materialized event.

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.next`

##### return()

> **return**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [sync/EventReaderSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L22)

Close the reader when iteration ends early.

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.return`

##### close()

> **close**(): `void`

Defined in: [sync/EventReaderSync.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L27)

Stop parsing and release the underlying input iterator.

###### Returns

`void`

***

### StreamReaderSync

Defined in: [sync/StreamReaderSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L19)

Synchronous current-token reader. Strings are scanned directly without
encoding; byte inputs are decoded in fatal mode with the configured encoding.

#### Constructors

##### Constructor

> **new StreamReaderSync**(`input`, `options?`): [`StreamReaderSync`](#streamreadersync)

Defined in: [sync/StreamReaderSync.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L25)

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

Defined in: [sync/StreamReaderSync.ts:44](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L44)

Advance to the next token, or return `null` at end of input.

###### Returns

[`XmlEventType`](#xmleventtype-1) \| `null`

##### close()

> **close**(): `void`

Defined in: [sync/StreamReaderSync.ts:64](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L64)

Stop parsing and release the underlying input iterator.

###### Returns

`void`

##### eventType()

> **eventType**(): [`XmlEventType`](#xmleventtype-1)

Defined in: [sync/StreamReaderSync.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L73)

Return the current token type.

###### Returns

[`XmlEventType`](#xmleventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:75](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L75)

Return the current element's qualified name.

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L77)

Return text carried by the current text-like token.

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L79)

Return the current element's local name.

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string`

Defined in: [sync/StreamReaderSync.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L81)

Return the current element's namespace prefix, or an empty string.

###### Returns

`string`

##### namespaceURI()

> **namespaceURI**(): `string`

Defined in: [sync/StreamReaderSync.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L83)

Return the namespace URI resolved for the current element.

###### Returns

`string`

##### attributeCount()

> **attributeCount**(): `number`

Defined in: [sync/StreamReaderSync.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L85)

Return the number of attributes on the current start element.

###### Returns

`number`

##### attributeName()

> **attributeName**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L87)

Return an attribute's qualified name by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeLocalName()

> **attributeLocalName**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:89](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L89)

Return an attribute's local name by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributePrefix()

> **attributePrefix**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:91](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L91)

Return an attribute's namespace prefix by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeNamespaceURI()

> **attributeNamespaceURI**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:93](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L93)

Return an attribute's namespace URI by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeValue()

> **attributeValue**(`indexOrNameOrNamespace`, `localName?`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:95](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L95)

Return an attribute value by index, qualified name, or namespace URI plus local name.

###### Parameters

###### indexOrNameOrNamespace

`string` \| `number`

###### localName?

`string`

###### Returns

`string` \| `undefined`

##### namespaceURIForPrefix()

> **namespaceURIForPrefix**(`prefix`): `string`

Defined in: [sync/StreamReaderSync.ts:101](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L101)

Resolve a namespace prefix in the current element scope.

###### Parameters

###### prefix

`string`

###### Returns

`string`

***

### WriterSync

Defined in: [sync/WriterSync.ts:535](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L535)

String-based sync writer.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSync**(`options?`): [`WriterSync`](#writersync)

Defined in: [sync/WriterSync.ts:538](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L538)

###### Parameters

###### options?

[`WriterSyncOptions`](#writersyncoptions) = `{}`

###### Returns

[`WriterSync`](#writersync)

###### Overrides

`AbstractWriterSync.constructor`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: [sync/WriterSync.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L152)

Writes the XML declaration (e.g., <?xml version="1.0" encoding="UTF-8"?>).

###### Parameters

###### version?

`"1.0"` = `'1.0'`

###### encoding?

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeStartDocument`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: [sync/WriterSync.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L171)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Inherited from

`AbstractWriterSync.writeEndDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: [sync/WriterSync.ts:184](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L184)

Start an element and leave its start tag open for attributes.

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

Defined in: [sync/WriterSync.ts:236](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L236)

Add an attribute to the currently open start tag.

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

Defined in: [sync/WriterSync.ts:258](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L258)

Declare a namespace on the currently open start tag.

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

Defined in: [sync/WriterSync.ts:277](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L277)

Write escaped character data.

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [sync/WriterSync.ts:293](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L293)

Write a CDATA section.

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [sync/WriterSync.ts:312](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L312)

Write an XML comment.

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [sync/WriterSync.ts:329](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L329)

Write a processing instruction.

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

Defined in: [sync/WriterSync.ts:355](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L355)

Write trusted XML verbatim without validation or escaping.

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [sync/WriterSync.ts:365](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L365)

Close the most recently opened element.

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [sync/WriterSync.ts:401](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L401)

Enable or disable indentation for subsequent output.

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [sync/WriterSync.ts:407](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L407)

Set the indentation unit used by pretty printing.

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [sync/WriterSync.ts:414](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L414)

Return whether pretty printing is enabled.

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [sync/WriterSync.ts:419](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L419)

Return the current indentation unit.

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### getXmlString()

> **getXmlString**(): `string`

Defined in: [sync/WriterSync.ts:543](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L543)

Return all XML serialized so far.

###### Returns

`string`

***

### WriterSyncSink

Defined in: [sync/WriterSync.ts:555](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L555)

Sink-based sync writer. Use this for file/buffer incremental writes.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSyncSink**(`sink`, `options?`): [`WriterSyncSink`](#writersyncsink)

Defined in: [sync/WriterSync.ts:563](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L563)

###### Parameters

###### sink

[`SyncTextSink`](#synctextsink)

###### options?

[`WriterSyncSinkOptions`](#writersyncsinkoptions) = `{}`

###### Returns

[`WriterSyncSink`](#writersyncsink)

###### Overrides

`AbstractWriterSync.constructor`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: [sync/WriterSync.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L152)

Writes the XML declaration (e.g., <?xml version="1.0" encoding="UTF-8"?>).

###### Parameters

###### version?

`"1.0"` = `'1.0'`

###### encoding?

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeStartDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: [sync/WriterSync.ts:184](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L184)

Start an element and leave its start tag open for attributes.

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

Defined in: [sync/WriterSync.ts:236](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L236)

Add an attribute to the currently open start tag.

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

Defined in: [sync/WriterSync.ts:258](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L258)

Declare a namespace on the currently open start tag.

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

Defined in: [sync/WriterSync.ts:277](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L277)

Write escaped character data.

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [sync/WriterSync.ts:293](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L293)

Write a CDATA section.

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [sync/WriterSync.ts:312](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L312)

Write an XML comment.

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [sync/WriterSync.ts:329](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L329)

Write a processing instruction.

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

Defined in: [sync/WriterSync.ts:355](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L355)

Write trusted XML verbatim without validation or escaping.

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [sync/WriterSync.ts:365](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L365)

Close the most recently opened element.

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [sync/WriterSync.ts:401](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L401)

Enable or disable indentation for subsequent output.

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [sync/WriterSync.ts:407](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L407)

Set the indentation unit used by pretty printing.

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [sync/WriterSync.ts:414](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L414)

Return whether pretty printing is enabled.

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [sync/WriterSync.ts:419](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L419)

Return the current indentation unit.

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: [sync/WriterSync.ts:620](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L620)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Overrides

`AbstractWriterSync.writeEndDocument`

##### flush()

> **flush**(): `void`

Defined in: [sync/WriterSync.ts:629](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L629)

Emit buffered text and invoke the sink's optional `flush()` hook.

###### Returns

`void`

##### close()

> **close**(): `void`

Defined in: [sync/WriterSync.ts:637](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L637)

Finalize the document, emit buffered text, and close the sink.

###### Returns

`void`

## Interfaces

### EventReaderOptions

Defined in: [async/EventReader.ts:5](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L5)

Options for the asynchronous materialized-event reader.

#### Extends

- [`StreamReaderOptions`](#streamreaderoptions)

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [async/StreamReader.ts:7](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L7)

###### Inherited from

[`StreamReaderOptions`](#streamreaderoptions).[`documentMode`](#documentmode-1)

##### namespaceAware?

> `optional` **namespaceAware?**: `boolean`

Defined in: [async/StreamReader.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L9)

Resolve namespaces and omit xmlns declarations from attributes.

###### Default Value

```ts
true
```

###### Inherited from

[`StreamReaderOptions`](#streamreaderoptions).[`namespaceAware`](#namespaceaware-1)

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [async/StreamReader.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L11)

TextDecoder encoding label for byte input.

###### Default Value

```ts
'utf-8'
```

###### Inherited from

[`StreamReaderOptions`](#streamreaderoptions).[`encoding`](#encoding-1)

***

### StreamReaderOptions

Defined in: [async/StreamReader.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L6)

Options for asynchronous current-token parsing.

#### Extended by

- [`EventReaderOptions`](#eventreaderoptions)

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [async/StreamReader.ts:7](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L7)

##### namespaceAware?

> `optional` **namespaceAware?**: `boolean`

Defined in: [async/StreamReader.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L9)

Resolve namespaces and omit xmlns declarations from attributes.

###### Default Value

```ts
true
```

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [async/StreamReader.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L11)

TextDecoder encoding label for byte input.

###### Default Value

```ts
'utf-8'
```

***

### WriterOptions

Defined in: [async/Writer.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L27)

Configuration options for the Writer

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [async/Writer.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L33)

XML declaration encoding. Byte-stream output is always UTF-8. For an
AsyncTextSink, this value must match the sink encoding.

###### Default Value

```ts
'utf-8'
```

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [async/Writer.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L39)

Whether to format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [async/Writer.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L45)

String used for indentation when prettyPrint is true

###### Default Value

```ts
'  '
```

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [async/Writer.ts:51](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L51)

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

Defined in: [async/Writer.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L57)

Whether to automatically encode XML entities

###### Default Value

```ts
true
```

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [async/Writer.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L63)

Internal buffer size in bytes, or UTF-16 code units for AsyncTextSink output

###### Default Value

```ts
16384
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [async/Writer.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L69)

Automatic flush threshold (percentage or output units of bufferSize)

###### Default Value

```ts
0.8
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [async/Writer.ts:75](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L75)

Whether to enable automatic flushing

###### Default Value

```ts
true
```

***

### AsyncTextSink

Defined in: [async/Writer.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L79)

Text output boundary for caller-provided streaming encoders.

#### Properties

##### encoding

> `readonly` **encoding**: `string`

Defined in: [async/Writer.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L81)

Encoding produced after this text sink's external encoding stage.

#### Methods

##### write()

> **write**(`chunk`): `void` \| `Promise`\<`void`\>

Defined in: [async/Writer.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L83)

Accept a serialized XML text chunk.

###### Parameters

###### chunk

`string`

###### Returns

`void` \| `Promise`\<`void`\>

##### flush()?

> `optional` **flush**(): `void` \| `Promise`\<`void`\>

Defined in: [async/Writer.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L85)

Flush the external encoding/output chain, when supported.

###### Returns

`void` \| `Promise`\<`void`\>

##### close()?

> `optional` **close**(): `void` \| `Promise`\<`void`\>

Defined in: [async/Writer.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L87)

Close the external encoding/output chain, when supported.

###### Returns

`void` \| `Promise`\<`void`\>

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

> **attributes**: [`EventAttributes`](#eventattributes)

Defined in: [core/types.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L49)

***

### EventAttribute

Defined in: [core/types.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L53)

Materialized attribute attached to a start-element event.

#### Properties

##### name

> **name**: `string`

Defined in: [core/types.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L53)

##### localName

> **localName**: `string`

Defined in: [core/types.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L53)

##### prefix

> **prefix**: `string`

Defined in: [core/types.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L53)

##### namespaceURI

> **namespaceURI**: `string`

Defined in: [core/types.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L53)

##### value

> **value**: `string`

Defined in: [core/types.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L53)

***

### EventAttributes

Defined in: [core/types.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L62)

Attribute lookup table keyed by qualified XML name.

#### Remarks

Iteration follows source order. `JSON.stringify()` emits the same object
shape as a record while reserved JavaScript property names remain safe.

#### Extends

- `ReadonlyMap`\<`string`, [`EventAttribute`](#eventattribute)\>

#### Methods

##### toJSON()

> **toJSON**(): `Record`\<`string`, [`EventAttribute`](#eventattribute)\>

Return a qualified-name record for JSON serialization.

###### Returns

`Record`\<`string`, [`EventAttribute`](#eventattribute)\>

***

### EndElementEvent

Defined in: [core/types.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L56)

Event emitted when an XML element ends.

#### Properties

##### type

> **type**: `"END_ELEMENT"`

Defined in: [core/types.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L57)

##### name

> **name**: `string`

Defined in: [core/types.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L58)

##### localName

> **localName**: `string`

Defined in: [core/types.ts:59](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L59)

##### prefix

> **prefix**: `string`

Defined in: [core/types.ts:60](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L60)

##### namespaceURI

> **namespaceURI**: `string`

Defined in: [core/types.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L61)

***

### CharactersEvent

Defined in: [core/types.ts:65](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L65)

Event containing ordinary character data.

#### Properties

##### type

> **type**: `"CHARACTERS"`

Defined in: [core/types.ts:66](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L66)

##### value

> **value**: `string`

Defined in: [core/types.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L67)

***

### CdataEvent

Defined in: [core/types.ts:71](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L71)

Event containing CDATA content.

#### Properties

##### type

> **type**: `"CDATA"`

Defined in: [core/types.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L72)

##### value

> **value**: `string`

Defined in: [core/types.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L73)

***

### CommentEvent

Defined in: [core/types.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L77)

Event containing an XML comment.

#### Properties

##### type

> **type**: `"COMMENT"`

Defined in: [core/types.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L77)

##### value

> **value**: `string`

Defined in: [core/types.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L77)

***

### ProcessingInstructionEvent

Defined in: [core/types.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L79)

Event containing an XML processing instruction.

#### Properties

##### type

> **type**: `"PROCESSING_INSTRUCTION"`

Defined in: [core/types.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L79)

##### target

> **target**: `string`

Defined in: [core/types.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L79)

##### data

> **data**: `string`

Defined in: [core/types.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L79)

***

### DtdEvent

Defined in: [core/types.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L81)

Event containing a document type declaration.

#### Properties

##### type

> **type**: `"DTD"`

Defined in: [core/types.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L81)

##### value

> **value**: `string`

Defined in: [core/types.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L81)

***

### AttributeInfo

Defined in: [core/types.ts:100](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L100)

Attribute information interface

#### Properties

##### value

> **value**: `string`

Defined in: [core/types.ts:101](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L101)

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [core/types.ts:102](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L102)

##### uri?

> `optional` **uri?**: `string`

Defined in: [core/types.ts:103](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L103)

***

### WriteElementOptions

Defined in: [core/types.ts:170](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L170)

Element writing options interface (for Writer)

#### Properties

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [core/types.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L171)

##### uri?

> `optional` **uri?**: `string`

Defined in: [core/types.ts:172](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L172)

##### attributes?

> `optional` **attributes?**: `Record`\<`string`, `string` \| [`AttributeInfo`](#attributeinfo)\>

Defined in: [core/types.ts:173](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L173)

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: [core/types.ts:174](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L174)

##### comment?

> `optional` **comment?**: `string`

Defined in: [core/types.ts:175](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L175)

***

### EventReaderSyncOptions

Defined in: [sync/EventReaderSync.ts:5](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L5)

Options for the synchronous materialized-event reader.

#### Extends

- [`StreamReaderSyncOptions`](#streamreadersyncoptions)

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [sync/StreamReaderSync.ts:7](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L7)

###### Inherited from

[`StreamReaderSyncOptions`](#streamreadersyncoptions).[`documentMode`](#documentmode-4)

##### namespaceAware?

> `optional` **namespaceAware?**: `boolean`

Defined in: [sync/StreamReaderSync.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L9)

Resolve namespaces and omit xmlns declarations from attributes.

###### Default Value

```ts
true
```

###### Inherited from

[`StreamReaderSyncOptions`](#streamreadersyncoptions).[`namespaceAware`](#namespaceaware-3)

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [sync/StreamReaderSync.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L11)

TextDecoder encoding label for byte input.

###### Default Value

```ts
'utf-8'
```

###### Inherited from

[`StreamReaderSyncOptions`](#streamreadersyncoptions).[`encoding`](#encoding-5)

***

### StreamReaderSyncOptions

Defined in: [sync/StreamReaderSync.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L6)

Options for synchronous current-token parsing.

#### Extended by

- [`EventReaderSyncOptions`](#eventreadersyncoptions)

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [sync/StreamReaderSync.ts:7](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L7)

##### namespaceAware?

> `optional` **namespaceAware?**: `boolean`

Defined in: [sync/StreamReaderSync.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L9)

Resolve namespaces and omit xmlns declarations from attributes.

###### Default Value

```ts
true
```

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [sync/StreamReaderSync.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L11)

TextDecoder encoding label for byte input.

###### Default Value

```ts
'utf-8'
```

***

### SyncTextSink

Defined in: [sync/WriterSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L19)

Sink interface for custom sync targets.

#### Properties

##### encoding?

> `readonly` `optional` **encoding?**: `string`

Defined in: [sync/WriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L21)

Encoding produced after this sink's external encoding stage. Defaults to UTF-8.

#### Methods

##### write()

> **write**(`chunk`): `void`

Defined in: [sync/WriterSync.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L23)

Accept a serialized XML text chunk.

###### Parameters

###### chunk

`string`

###### Returns

`void`

##### flush()?

> `optional` **flush**(): `void`

Defined in: [sync/WriterSync.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L25)

Flush buffered sink data, when supported.

###### Returns

`void`

##### close()?

> `optional` **close**(): `void`

Defined in: [sync/WriterSync.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L27)

Close the sink, when supported.

###### Returns

`void`

***

### WriterSyncOptions

Defined in: [sync/WriterSync.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L33)

Writer output options shared by string and sink variants.

#### Extended by

- [`WriterSyncSinkOptions`](#writersyncsinkoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [sync/WriterSync.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L35)

XML declaration encoding. WriterSync accepts UTF-8; WriterSyncSink requires it to match the sink encoding.

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [sync/WriterSync.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L36)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [sync/WriterSync.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L37)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [sync/WriterSync.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L38)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [sync/WriterSync.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L39)

***

### WriterSyncSinkOptions

Defined in: [sync/WriterSync.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L45)

Writer options for sink-based sync mode.

#### Extends

- [`WriterSyncOptions`](#writersyncoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [sync/WriterSync.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L35)

XML declaration encoding. WriterSync accepts UTF-8; WriterSyncSink requires it to match the sink encoding.

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`encoding`](#encoding-7)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [sync/WriterSync.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L36)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`prettyPrint`](#prettyprint-1)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [sync/WriterSync.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L37)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`indentString`](#indentstring-1)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [sync/WriterSync.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L38)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`addEntities`](#addentities-1)

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [sync/WriterSync.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L39)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`autoEncodeEntities`](#autoencodeentities-1)

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [sync/WriterSync.ts:50](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L50)

Internal character buffer size.

###### Default Value

```ts
16384
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [sync/WriterSync.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L56)

Emit buffered chunks automatically when threshold is reached.

###### Default Value

```ts
true
```

##### flushOnClose?

> `optional` **flushOnClose?**: `boolean`

Defined in: [sync/WriterSync.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L62)

Whether to call sink.flush() when the writer is finalized.

###### Default Value

```ts
false
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [sync/WriterSync.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L69)

Flush threshold (percentage or absolute char count).
If <= 1, treated as percentage of bufferSize. Otherwise absolute char count.

###### Default Value

```ts
0.8
```

## Type Aliases

### StreamReaderSource

> **StreamReaderSource** = `AsyncIterable`\<`Uint8Array`\> \| `ReadableStream`\<`Uint8Array`\>

Defined in: [async/StreamReader.ts:4](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L4)

Byte-stream sources accepted by `StreamReader`.

***

### XmlEventType

> **XmlEventType** = *typeof* [`XmlEventType`](#xmleventtype)\[keyof *typeof* [`XmlEventType`](#xmleventtype)\]

Defined in: [core/types.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L6)

Enumeration of XML stream event types used by the StAX parser

***

### AnyXmlEvent

> **AnyXmlEvent** = [`StartDocumentEvent`](#startdocumentevent) \| [`EndDocumentEvent`](#enddocumentevent) \| [`StartElementEvent`](#startelementevent) \| [`EndElementEvent`](#endelementevent) \| [`CharactersEvent`](#charactersevent) \| [`CdataEvent`](#cdataevent) \| [`CommentEvent`](#commentevent) \| [`ProcessingInstructionEvent`](#processinginstructionevent) \| [`DtdEvent`](#dtdevent)

Defined in: [core/types.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L86)

Discriminated Union type for developer use

***

### DocumentMode

> **DocumentMode** = `"fragment"` \| `"document"`

Defined in: [core/types.ts:189](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L189)

XML document conformance mode.

***

### StreamReaderSyncInput

> **StreamReaderSyncInput** = `string` \| `Uint8Array` \| `Iterable`\<`Uint8Array`\>

Defined in: [sync/StreamReaderSync.ts:4](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L4)

Inputs accepted by `StreamReaderSync`.

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

Defined in: [core/types.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L116)

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

Defined in: [core/types.ts:125](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L125)

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

Defined in: [core/types.ts:134](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L134)

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

Defined in: [core/types.ts:142](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L142)

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

Defined in: [core/types.ts:155](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L155)

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

Defined in: [core/types.ts:163](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L163)

Type guard function - Check if the event is an END_DOCUMENT event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is EndDocumentEvent`

true if the event is an END_DOCUMENT event, false otherwise
