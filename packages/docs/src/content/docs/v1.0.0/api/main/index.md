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

Defined in: [async/EventReader.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L17)

Async iterator that yields stable, materialized XML event objects.

Use `StreamReader` instead when current-token access and lower allocation are
more important than retaining event objects.

#### Implements

- `AsyncIterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReader**(`input`, `options?`): [`EventReader`](#eventreader)

Defined in: [async/EventReader.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L19)

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

Defined in: [async/EventReader.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L21)

Return this reader as its async iterator.

###### Returns

`AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`AsyncIterable.[asyncIterator]`

##### next()

> **next**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: [async/EventReader.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L23)

Read the next materialized event.

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.next`

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [async/EventReader.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L25)

Stop parsing and close the underlying input iterator.

###### Returns

`Promise`\<`void`\>

##### return()

> **return**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: [async/EventReader.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L27)

Close the reader when async iteration ends early.

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.return`

***

### StreamReader

Defined in: [async/StreamReader.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L16)

Asynchronous, forward-only XML reader backed by a reusable token cursor.
Call `next()` before accessing the current token through the accessor methods.

#### Constructors

##### Constructor

> **new StreamReader**(`source`, `options?`): [`StreamReader`](#streamreader)

Defined in: [async/StreamReader.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L24)

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

Defined in: [async/StreamReader.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L31)

Advance to the next token, or return `null` at end of input.

###### Returns

`Promise`\<[`XmlEventType`](#xmleventtype-1) \| `null`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [async/StreamReader.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L33)

Stop parsing and close the underlying input iterator.

###### Returns

`Promise`\<`void`\>

##### eventType()

> **eventType**(): [`XmlEventType`](#xmleventtype-1)

Defined in: [async/StreamReader.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L35)

Return the current token type.

###### Returns

[`XmlEventType`](#xmleventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: [async/StreamReader.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L37)

Return the current element's qualified name.

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [async/StreamReader.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L39)

Return text carried by the current text-like token.

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: [async/StreamReader.ts:41](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L41)

Return the current element's local name.

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string`

Defined in: [async/StreamReader.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L43)

Return the current element's namespace prefix, or an empty string.

###### Returns

`string`

##### namespaceURI()

> **namespaceURI**(): `string`

Defined in: [async/StreamReader.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L45)

Return the namespace URI resolved for the current element.

###### Returns

`string`

##### attributeCount()

> **attributeCount**(): `number`

Defined in: [async/StreamReader.ts:47](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L47)

Return the number of attributes on the current start element.

###### Returns

`number`

##### attributeName()

> **attributeName**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L49)

Return an attribute's qualified name by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeLocalName()

> **attributeLocalName**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:51](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L51)

Return an attribute's local name by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributePrefix()

> **attributePrefix**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L53)

Return an attribute's namespace prefix by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeNamespaceURI()

> **attributeNamespaceURI**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L55)

Return an attribute's namespace URI by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeValue()

> **attributeValue**(`indexOrNameOrNamespace`, `localName?`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L57)

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

Defined in: [async/StreamReader.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L61)

Resolve a namespace prefix in the current element scope.

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

Defined in: [async/Writer.ts:162](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L162)

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

Defined in: [async/Writer.ts:279](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L279)

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

Defined in: [async/Writer.ts:303](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L303)

End document (automatically close all elements)

###### Returns

`Promise`\<`void`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [async/Writer.ts:324](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L324)

Finalize any open elements, flush buffered bytes, and close the underlying stream.

###### Returns

`Promise`\<`void`\>

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:331](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L331)

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

Defined in: [async/Writer.ts:438](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L438)

Write end element

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCharacters()

> **writeCharacters**(`text`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:471](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L471)

Write text

###### Parameters

###### text

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCData()

> **writeCData**(`cdata`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:494](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L494)

Write CDATA section

###### Parameters

###### cdata

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeComment()

> **writeComment**(`comment`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:515](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L515)

Write comment

###### Parameters

###### comment

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeRaw()

> **writeRaw**(`xml`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:539](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L539)

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

Defined in: [async/Writer.ts:548](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L548)

Manual flush

###### Returns

`Promise`\<`void`\>

##### getMetrics()

> **getMetrics**(): `object`

Defined in: [async/Writer.ts:555](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L555)

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

Defined in: [sync/EventReaderSync.ts:12](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L12)

Synchronous iterator that yields stable, materialized XML event objects.

#### Implements

- `Iterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReaderSync**(`input`, `options?`): [`EventReaderSync`](#eventreadersync)

Defined in: [sync/EventReaderSync.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L15)

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

Defined in: [sync/EventReaderSync.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L17)

Return this reader as its iterator.

###### Returns

`Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterable.[iterator]`

##### next()

> **next**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [sync/EventReaderSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L19)

Read the next materialized event.

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.next`

##### return()

> **return**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [sync/EventReaderSync.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L26)

Close the reader when iteration ends early.

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.return`

##### close()

> **close**(): `void`

Defined in: [sync/EventReaderSync.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L31)

Stop parsing and release the underlying input iterator.

###### Returns

`void`

***

### StreamReaderSync

Defined in: [sync/StreamReaderSync.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L17)

Synchronous current-token reader. Strings are scanned directly without
encoding; byte inputs are decoded as fatal UTF-8.

#### Constructors

##### Constructor

> **new StreamReaderSync**(`input`, `options?`): [`StreamReaderSync`](#streamreadersync)

Defined in: [sync/StreamReaderSync.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L23)

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

Defined in: [sync/StreamReaderSync.ts:42](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L42)

Advance to the next token, or return `null` at end of input.

###### Returns

[`XmlEventType`](#xmleventtype-1) \| `null`

##### close()

> **close**(): `void`

Defined in: [sync/StreamReaderSync.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L62)

Stop parsing and release the underlying input iterator.

###### Returns

`void`

##### eventType()

> **eventType**(): [`XmlEventType`](#xmleventtype-1)

Defined in: [sync/StreamReaderSync.ts:71](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L71)

Return the current token type.

###### Returns

[`XmlEventType`](#xmleventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L73)

Return the current element's qualified name.

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:75](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L75)

Return text carried by the current text-like token.

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L77)

Return the current element's local name.

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string`

Defined in: [sync/StreamReaderSync.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L79)

Return the current element's namespace prefix, or an empty string.

###### Returns

`string`

##### namespaceURI()

> **namespaceURI**(): `string`

Defined in: [sync/StreamReaderSync.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L81)

Return the namespace URI resolved for the current element.

###### Returns

`string`

##### attributeCount()

> **attributeCount**(): `number`

Defined in: [sync/StreamReaderSync.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L83)

Return the number of attributes on the current start element.

###### Returns

`number`

##### attributeName()

> **attributeName**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L85)

Return an attribute's qualified name by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeLocalName()

> **attributeLocalName**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L87)

Return an attribute's local name by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributePrefix()

> **attributePrefix**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:89](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L89)

Return an attribute's namespace prefix by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeNamespaceURI()

> **attributeNamespaceURI**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:91](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L91)

Return an attribute's namespace URI by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeValue()

> **attributeValue**(`indexOrNameOrNamespace`, `localName?`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:93](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L93)

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

Defined in: [sync/StreamReaderSync.ts:99](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L99)

Resolve a namespace prefix in the current element scope.

###### Parameters

###### prefix

`string`

###### Returns

`string`

***

### WriterSync

Defined in: [sync/WriterSync.ts:541](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L541)

String-based sync writer.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSync**(`options?`): [`WriterSync`](#writersync)

Defined in: [sync/WriterSync.ts:544](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L544)

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

Defined in: [sync/WriterSync.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L135)

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

Defined in: [sync/WriterSync.ts:153](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L153)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Inherited from

`AbstractWriterSync.writeEndDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: [sync/WriterSync.ts:166](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L166)

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

Defined in: [sync/WriterSync.ts:256](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L256)

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

Defined in: [sync/WriterSync.ts:274](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L274)

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

Defined in: [sync/WriterSync.ts:293](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L293)

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

Defined in: [sync/WriterSync.ts:309](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L309)

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

Defined in: [sync/WriterSync.ts:328](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L328)

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

Defined in: [sync/WriterSync.ts:345](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L345)

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

Defined in: [sync/WriterSync.ts:371](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L371)

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

Defined in: [sync/WriterSync.ts:378](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L378)

Close the most recently opened element.

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [sync/WriterSync.ts:411](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L411)

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

Defined in: [sync/WriterSync.ts:417](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L417)

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

Defined in: [sync/WriterSync.ts:424](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L424)

Return whether pretty printing is enabled.

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [sync/WriterSync.ts:429](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L429)

Return the current indentation unit.

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### getXmlString()

> **getXmlString**(): `string`

Defined in: [sync/WriterSync.ts:549](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L549)

Return all XML serialized so far.

###### Returns

`string`

***

### WriterSyncSink

Defined in: [sync/WriterSync.ts:561](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L561)

Sink-based sync writer. Use this for file/buffer incremental writes.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSyncSink**(`sink`, `options?`): [`WriterSyncSink`](#writersyncsink)

Defined in: [sync/WriterSync.ts:569](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L569)

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

Defined in: [sync/WriterSync.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L135)

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

Defined in: [sync/WriterSync.ts:166](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L166)

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

Defined in: [sync/WriterSync.ts:256](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L256)

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

Defined in: [sync/WriterSync.ts:274](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L274)

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

Defined in: [sync/WriterSync.ts:293](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L293)

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

Defined in: [sync/WriterSync.ts:309](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L309)

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

Defined in: [sync/WriterSync.ts:328](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L328)

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

Defined in: [sync/WriterSync.ts:345](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L345)

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

Defined in: [sync/WriterSync.ts:371](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L371)

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

Defined in: [sync/WriterSync.ts:378](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L378)

Close the most recently opened element.

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [sync/WriterSync.ts:411](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L411)

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

Defined in: [sync/WriterSync.ts:417](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L417)

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

Defined in: [sync/WriterSync.ts:424](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L424)

Return whether pretty printing is enabled.

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [sync/WriterSync.ts:429](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L429)

Return the current indentation unit.

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: [sync/WriterSync.ts:626](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L626)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Overrides

`AbstractWriterSync.writeEndDocument`

##### flush()

> **flush**(): `void`

Defined in: [sync/WriterSync.ts:635](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L635)

Emit buffered text and invoke the sink's optional `flush()` hook.

###### Returns

`void`

##### close()

> **close**(): `void`

Defined in: [sync/WriterSync.ts:643](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L643)

Finalize the document, emit buffered text, and close the sink.

###### Returns

`void`

## Interfaces

### EventReaderOptions

Defined in: [async/EventReader.ts:5](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L5)

Options for the asynchronous materialized-event reader.

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [async/EventReader.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L6)

##### namespaceAware?

> `optional` **namespaceAware?**: `boolean`

Defined in: [async/EventReader.ts:8](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/EventReader.ts#L8)

Resolve namespaces and omit xmlns declarations from attributes.

###### Default Value

```ts
true
```

***

### StreamReaderOptions

Defined in: [async/StreamReader.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L6)

Options for asynchronous current-token parsing.

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

##### localName

> **localName**: `string`

Defined in: [core/types.ts:102](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L102)

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [core/types.ts:103](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L103)

##### uri?

> `optional` **uri?**: `string`

Defined in: [core/types.ts:104](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L104)

***

### WriteElementOptions

Defined in: [core/types.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L171)

Element writing options interface (for Writer)

#### Properties

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [core/types.ts:172](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L172)

##### uri?

> `optional` **uri?**: `string`

Defined in: [core/types.ts:173](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L173)

##### attributes?

> `optional` **attributes?**: `Record`\<`string`, `string` \| [`AttributeInfo`](#attributeinfo)\>

Defined in: [core/types.ts:174](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L174)

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: [core/types.ts:175](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L175)

##### comment?

> `optional` **comment?**: `string`

Defined in: [core/types.ts:176](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L176)

***

### EventReaderSyncOptions

Defined in: [sync/EventReaderSync.ts:5](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L5)

Options for the synchronous materialized-event reader.

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [sync/EventReaderSync.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L6)

##### namespaceAware?

> `optional` **namespaceAware?**: `boolean`

Defined in: [sync/EventReaderSync.ts:8](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L8)

Resolve namespaces and omit xmlns declarations from attributes.

###### Default Value

```ts
true
```

***

### StreamReaderSyncOptions

Defined in: [sync/StreamReaderSync.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L6)

Options for synchronous current-token parsing.

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

***

### SyncTextSink

Defined in: [sync/WriterSync.ts:7](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L7)

Sink interface for custom sync targets.

#### Methods

##### write()

> **write**(`chunk`): `void`

Defined in: [sync/WriterSync.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L9)

Accept a serialized XML text chunk.

###### Parameters

###### chunk

`string`

###### Returns

`void`

##### flush()?

> `optional` **flush**(): `void`

Defined in: [sync/WriterSync.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L11)

Flush buffered sink data, when supported.

###### Returns

`void`

##### close()?

> `optional` **close**(): `void`

Defined in: [sync/WriterSync.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L13)

Close the sink, when supported.

###### Returns

`void`

***

### WriterSyncOptions

Defined in: [sync/WriterSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L19)

Writer output options shared by string and sink variants.

#### Extended by

- [`WriterSyncSinkOptions`](#writersyncsinkoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [sync/WriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L21)

XML declaration encoding. String output is not byte-encoded; only UTF-8 is accepted.

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [sync/WriterSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L22)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [sync/WriterSync.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L23)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [sync/WriterSync.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L24)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [sync/WriterSync.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L25)

***

### WriterSyncSinkOptions

Defined in: [sync/WriterSync.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L31)

Writer options for sink-based sync mode.

#### Extends

- [`WriterSyncOptions`](#writersyncoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [sync/WriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L21)

XML declaration encoding. String output is not byte-encoded; only UTF-8 is accepted.

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`encoding`](#encoding-1)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [sync/WriterSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L22)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`prettyPrint`](#prettyprint-1)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [sync/WriterSync.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L23)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`indentString`](#indentstring-1)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [sync/WriterSync.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L24)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`addEntities`](#addentities-1)

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [sync/WriterSync.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L25)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`autoEncodeEntities`](#autoencodeentities-1)

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [sync/WriterSync.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L36)

Internal character buffer size.

###### Default Value

```ts
16384
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [sync/WriterSync.ts:42](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L42)

Emit buffered chunks automatically when threshold is reached.

###### Default Value

```ts
true
```

##### flushOnClose?

> `optional` **flushOnClose?**: `boolean`

Defined in: [sync/WriterSync.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L48)

Whether to call sink.flush() when the writer is finalized.

###### Default Value

```ts
false
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [sync/WriterSync.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L55)

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

Defined in: [core/types.ts:190](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L190)

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

Defined in: [core/types.ts:117](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L117)

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

Defined in: [core/types.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L126)

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

Defined in: [core/types.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L135)

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

Defined in: [core/types.ts:143](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L143)

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

Defined in: [core/types.ts:156](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L156)

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

Defined in: [core/types.ts:164](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L164)

Type guard function - Check if the event is an END_DOCUMENT event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is EndDocumentEvent`

true if the event is an END_DOCUMENT event, false otherwise
