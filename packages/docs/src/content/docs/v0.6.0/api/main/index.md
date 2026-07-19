---
title: stax-xml
description: API reference for stax-xml
slug: v0.6.0/api/main
---

**stax-xml**

***

# stax-xml

## Classes

### StaxXmlParser

Defined in: [StaxXmlParser.ts:103](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L103)

High-performance asynchronous XML parser implementing the StAX (Streaming API for XML) pattern.

This parser provides memory-efficient processing of large XML files through streaming
with support for pull-based parsing, custom entity handling, and namespace processing.

#### Remarks

The parser uses UTF-8 safe processing with Boyer-Moore-Horspool pattern search optimization
and supports both single-event and batch processing modes for improved performance.

#### Examples

Basic usage:
```typescript
const xmlContent = '<root><item>Hello</item></root>';
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

const parser = new StaxXmlParser(stream);
for await (const event of parser) {
  console.log(event.type, event);
}
```

With custom options:
```typescript
const options = {
  autoDecodeEntities: true,
  maxBufferSize: 128 * 1024,
  addEntities: [{ entity: 'custom', value: 'replacement' }]
};
const parser = new StaxXmlParser(stream, options);
```

#### Implements

- `AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new StaxXmlParser**(`xmlStream`, `options`): [`StaxXmlParser`](#staxxmlparser)

Defined in: [StaxXmlParser.ts:187](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L187)

Creates a new StaxXmlParser instance.

###### Parameters

###### xmlStream

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The ReadableStream containing XML data as Uint8Array chunks

###### options

[`StaxXmlParserOptions`](#staxxmlparseroptions) = `{}`

Configuration options for the parser

###### Returns

[`StaxXmlParser`](#staxxmlparser)

###### Throws

When xmlStream is not a valid ReadableStream

###### Example

```typescript
const xmlData = '<root><item>content</item></root>';
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlData));
    controller.close();
  }
});

const parser = new StaxXmlParser(stream, {
  autoDecodeEntities: true,
  maxBufferSize: 64 * 1024
});
```

#### Accessors

##### XmlEventType

###### Get Signature

> **get** **XmlEventType**(): `object`

Defined in: [StaxXmlParser.ts:1089](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L1089)

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

##### nextBatch()

> **nextBatch**(`size?`): `Promise`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

Defined in: [StaxXmlParser.ts:485](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L485)

###### Parameters

###### size?

`number`

###### Returns

`Promise`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

##### batchedIterator()

> **batchedIterator**(`batchSize?`): `AsyncGenerator`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

Defined in: [StaxXmlParser.ts:504](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L504)

###### Parameters

###### batchSize?

`number`

###### Returns

`AsyncGenerator`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

##### next()

> **next**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: [StaxXmlParser.ts:750](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L750)

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

###### Implementation of

`AsyncIterator.next`

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [StaxXmlParser.ts:769](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L769)

###### Returns

`AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

***

### StaxXmlParserSync

Defined in: [StaxXmlParserSync.ts:19](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParserSync.ts#L19)

#### Implements

- `Iterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new StaxXmlParserSync**(`xml`, `options`): [`StaxXmlParserSync`](#staxxmlparsersync)

Defined in: [StaxXmlParserSync.ts:73](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParserSync.ts#L73)

###### Parameters

###### xml

`string`

###### options

[`StaxXmlParserSyncOptions`](#staxxmlparsersyncoptions) = `{}`

###### Returns

[`StaxXmlParserSync`](#staxxmlparsersync)

#### Methods

##### \[iterator\]()

> **\[iterator\]**(): `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [StaxXmlParserSync.ts:247](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParserSync.ts#L247)

Symbol.iterator implementation - returns this instance as iterator
This ensures for...of and explicit next() calls use the same iterator state

###### Returns

`Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterable.[iterator]`

##### next()

> **next**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [StaxXmlParserSync.ts:350](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParserSync.ts#L350)

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.next`

***

### StaxXmlWriter

Defined in: [StaxXmlWriter.ts:126](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L126)

High-performance asynchronous XML writer implementing the StAX (Streaming API for XML) pattern.

This writer provides efficient streaming XML generation using WritableStream for handling
large XML documents with automatic buffering, backpressure management, and namespace support.

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

const writer = new StaxXmlWriter(writableStream);
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
const writer = new StaxXmlWriter(writableStream, options);
```

#### Constructors

##### Constructor

> **new StaxXmlWriter**(`stream`, `options`): [`StaxXmlWriter`](#staxxmlwriter)

Defined in: [StaxXmlWriter.ts:149](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L149)

###### Parameters

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options

[`StaxXmlWriterOptions`](#staxxmlwriteroptions) = `{}`

###### Returns

[`StaxXmlWriter`](#staxxmlwriter)

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version`, `encoding?`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:243](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L243)

Write XML declaration

###### Parameters

###### version

`string` = `'1.0'`

###### encoding?

`string`

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeEndDocument()

> **writeEndDocument**(): `Promise`\<`void`\>

Defined in: [StaxXmlWriter.ts:268](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L268)

End document (automatically close all elements)

###### Returns

`Promise`\<`void`\>

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:289](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L289)

Write start element

###### Parameters

###### localName

`string`

###### options?

[`WriteElementOptions`](#writeelementoptions)

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeEndElement()

> **writeEndElement**(): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:366](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L366)

Write end element

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeCharacters()

> **writeCharacters**(`text`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:402](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L402)

Write text

###### Parameters

###### text

`string`

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeCData()

> **writeCData**(`cdata`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:424](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L424)

Write CDATA section

###### Parameters

###### cdata

`string`

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeComment()

> **writeComment**(`comment`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:444](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L444)

Write comment

###### Parameters

###### comment

`string`

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeRaw()

> **writeRaw**(`xml`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:467](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L467)

Write raw XML content without escaping

###### Parameters

###### xml

`string`

Raw XML string to write

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

this (chainable)

##### flush()

> **flush**(): `Promise`\<`void`\>

Defined in: [StaxXmlWriter.ts:476](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L476)

Manual flush

###### Returns

`Promise`\<`void`\>

##### getMetrics()

> **getMetrics**(): `object`

Defined in: [StaxXmlWriter.ts:483](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L483)

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

### StaxXmlWriterSync

Defined in: [StaxXmlWriterSync.ts:41](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L41)

A class for writing XML similar to StAX XMLStreamWriter.
This is a simplified implementation that does not support namespace and complex PI/comment management.

#### Constructors

##### Constructor

> **new StaxXmlWriterSync**(`options`): [`StaxXmlWriterSync`](#staxxmlwritersync)

Defined in: [StaxXmlWriterSync.ts:53](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L53)

###### Parameters

###### options

[`StaxXmlWriterSyncOptions`](#staxxmlwritersyncoptions) = `{}`

###### Returns

[`StaxXmlWriterSync`](#staxxmlwritersync)

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version`, `encoding?`): `this`

Defined in: [StaxXmlWriterSync.ts:88](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L88)

Writes the XML declaration (e.g., <?xml version="1.0" encoding="UTF-8"?>).
Should be called only once at the very beginning of the document.

###### Parameters

###### version

`string` = `'1.0'`

XML version (default: "1.0")

###### encoding?

`string`

Encoding (default: value set in constructor)

###### Returns

`this`

this (chainable)

###### Throws

Error when called in incorrect state

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: [StaxXmlWriterSync.ts:114](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L114)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

Promise<void> Promise that resolves when stream is flushed

##### getXmlString()

> **getXmlString**(): `string`

Defined in: [StaxXmlWriterSync.ts:131](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L131)

Returns the written XML string.
Should be called after writeEndDocument() to get the complete XML.

###### Returns

`string`

The written XML string

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: [StaxXmlWriterSync.ts:142](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L142)

Writes a start element (e.g., <element> or <prefix:element>).

###### Parameters

###### localName

`string`

Local name of the element

###### options?

[`WriteElementOptions`](#writeelementoptions)

Element writing options (prefix, uri, attributes, selfClosing)

###### Returns

`this`

this (chainable)

###### Throws

Error when called in incorrect state

##### writeAttribute()

> **writeAttribute**(`localName`, `value`, `prefix?`): `this`

Defined in: [StaxXmlWriterSync.ts:229](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L229)

Writes an attribute. Can only be called immediately after writeStartElement().

###### Parameters

###### localName

`string`

Local name of the attribute

###### value

`string`

Attribute value

###### prefix?

`string`

Namespace prefix of the attribute (note: this implementation does not manage namespace mapping)

###### Returns

`this`

this (chainable)

###### Throws

Error when called in incorrect state

##### writeNamespace()

> **writeNamespace**(`prefix`, `uri`): `this`

Defined in: [StaxXmlWriterSync.ts:249](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L249)

Writes a namespace declaration. Can only be called immediately after writeStartElement().
This implementation simply writes the string in the form xmlns:prefix="uri" or xmlns="uri".
Actual namespace validation/management logic is not included.

###### Parameters

###### prefix

`string`

Namespace prefix

###### uri

`string`

Namespace URI

###### Returns

`this`

this (chainable)

###### Throws

Error when called in incorrect state

##### writeCharacters()

> **writeCharacters**(`text`): `this`

Defined in: [StaxXmlWriterSync.ts:273](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L273)

Writes text content.

###### Parameters

###### text

`string`

Text to write

###### Returns

`this`

this (chainable)

###### Throws

Error when called in incorrect state

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [StaxXmlWriterSync.ts:296](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L296)

Writes a CDATA section.

###### Parameters

###### cdata

`string`

CDATA content

###### Returns

`this`

this (chainable)

###### Throws

Error when called in incorrect state (especially when containing ']]>' sequence)

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [StaxXmlWriterSync.ts:323](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L323)

Writes a comment.

###### Parameters

###### comment

`string`

Comment content

###### Returns

`this`

this (chainable)

###### Throws

Error when called in incorrect state (especially when containing '--' sequence)

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [StaxXmlWriterSync.ts:346](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L346)

Writes a processing instruction (Processing Instruction).

###### Parameters

###### target

`string`

PI target

###### data?

`string`

PI data (optional)

###### Returns

`this`

this (chainable)

###### Throws

Error when called in incorrect state (especially when containing '?>' sequence)

##### writeRaw()

> **writeRaw**(`xml`): `this`

Defined in: [StaxXmlWriterSync.ts:372](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L372)

Writes raw XML content without escaping

###### Parameters

###### xml

`string`

Raw XML string to write

###### Returns

`this`

this (chainable)

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [StaxXmlWriterSync.ts:383](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L383)

Closes the currently open element (e.g., </element> or </prefix:element>).

###### Returns

`this`

this (chainable)

###### Throws

Error when called with no open elements

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [StaxXmlWriterSync.ts:420](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L420)

Enables/disables pretty print functionality.

###### Parameters

###### enabled

`boolean`

Whether to enable pretty print

###### Returns

`this`

this (chainable)

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [StaxXmlWriterSync.ts:430](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L430)

Sets the indentation string.

###### Parameters

###### indentString

`string`

String to use for indentation (e.g., '  ', '\t', '    ')

###### Returns

`this`

this (chainable)

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [StaxXmlWriterSync.ts:439](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L439)

Returns the current pretty print setting.

###### Returns

`boolean`

Whether pretty print is enabled

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [StaxXmlWriterSync.ts:447](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L447)

Returns the current indentation string.

###### Returns

`string`

Currently set indentation string

## Interfaces

### StaxXmlParserOptions

Defined in: [StaxXmlParser.ts:19](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L19)

Configuration options for the StaxXmlParser

#### Properties

##### encoding?

> `optional` **encoding**: `string`

Defined in: [StaxXmlParser.ts:24](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L24)

Text encoding for the input stream

###### Default Value

```ts
'utf-8'
```

##### addEntities?

> `optional` **addEntities**: `object`[]

Defined in: [StaxXmlParser.ts:30](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L30)

Additional custom entities to decode

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Default Value

```ts
[]
```

##### autoDecodeEntities?

> `optional` **autoDecodeEntities**: `boolean`

Defined in: [StaxXmlParser.ts:36](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L36)

Whether to automatically decode XML entities

###### Default Value

```ts
true
```

##### maxBufferSize?

> `optional` **maxBufferSize**: `number`

Defined in: [StaxXmlParser.ts:42](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L42)

Maximum buffer size in bytes

###### Default Value

```ts
65536
```

##### enableBufferCompaction?

> `optional` **enableBufferCompaction**: `boolean`

Defined in: [StaxXmlParser.ts:48](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L48)

Whether to enable buffer compaction for memory efficiency

###### Default Value

```ts
true
```

##### batchSize?

> `optional` **batchSize**: `number`

Defined in: [StaxXmlParser.ts:54](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L54)

Number of events to batch together

###### Default Value

```ts
1
```

##### batchTimeout?

> `optional` **batchTimeout**: `number`

Defined in: [StaxXmlParser.ts:60](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParser.ts#L60)

Timeout for batch processing in milliseconds

###### Default Value

```ts
0
```

***

### StaxXmlParserSyncOptions

Defined in: [StaxXmlParserSync.ts:14](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParserSync.ts#L14)

#### Properties

##### autoDecodeEntities?

> `optional` **autoDecodeEntities**: `boolean`

Defined in: [StaxXmlParserSync.ts:15](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParserSync.ts#L15)

##### addEntities?

> `optional` **addEntities**: `object`[]

Defined in: [StaxXmlParserSync.ts:16](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlParserSync.ts#L16)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

***

### StaxXmlWriterOptions

Defined in: [StaxXmlWriter.ts:25](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L25)

Configuration options for the StaxXmlWriter

#### Properties

##### encoding?

> `optional` **encoding**: `string`

Defined in: [StaxXmlWriter.ts:30](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L30)

Text encoding for the output stream

###### Default Value

```ts
'utf-8'
```

##### prettyPrint?

> `optional` **prettyPrint**: `boolean`

Defined in: [StaxXmlWriter.ts:36](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L36)

Whether to format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString**: `string`

Defined in: [StaxXmlWriter.ts:42](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L42)

String used for indentation when prettyPrint is true

###### Default Value

```ts
'  '
```

##### addEntities?

> `optional` **addEntities**: `object`[]

Defined in: [StaxXmlWriter.ts:48](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L48)

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

> `optional` **autoEncodeEntities**: `boolean`

Defined in: [StaxXmlWriter.ts:54](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L54)

Whether to automatically encode XML entities

###### Default Value

```ts
true
```

##### namespaces?

> `optional` **namespaces**: `NamespaceDeclaration`[]

Defined in: [StaxXmlWriter.ts:60](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L60)

Namespace declarations to include

###### Default Value

```ts
[]
```

##### bufferSize?

> `optional` **bufferSize**: `number`

Defined in: [StaxXmlWriter.ts:66](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L66)

Internal buffer size in bytes

###### Default Value

```ts
16384
```

##### highWaterMark?

> `optional` **highWaterMark**: `number`

Defined in: [StaxXmlWriter.ts:72](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L72)

WritableStream backpressure threshold

###### Default Value

```ts
65536
```

##### flushThreshold?

> `optional` **flushThreshold**: `number`

Defined in: [StaxXmlWriter.ts:78](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L78)

Automatic flush threshold (percentage of bufferSize)

###### Default Value

```ts
0.8
```

##### enableAutoFlush?

> `optional` **enableAutoFlush**: `boolean`

Defined in: [StaxXmlWriter.ts:84](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriter.ts#L84)

Whether to enable automatic flushing

###### Default Value

```ts
true
```

***

### StaxXmlWriterSyncOptions

Defined in: [StaxXmlWriterSync.ts:27](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L27)

#### Properties

##### encoding?

> `optional` **encoding**: `string`

Defined in: [StaxXmlWriterSync.ts:28](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L28)

##### prettyPrint?

> `optional` **prettyPrint**: `boolean`

Defined in: [StaxXmlWriterSync.ts:29](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L29)

##### indentString?

> `optional` **indentString**: `string`

Defined in: [StaxXmlWriterSync.ts:30](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L30)

##### addEntities?

> `optional` **addEntities**: `object`[]

Defined in: [StaxXmlWriterSync.ts:31](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L31)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### autoEncodeEntities?

> `optional` **autoEncodeEntities**: `boolean`

Defined in: [StaxXmlWriterSync.ts:32](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L32)

##### namespaces?

> `optional` **namespaces**: `NamespaceDeclaration`[]

Defined in: [StaxXmlWriterSync.ts:33](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/StaxXmlWriterSync.ts#L33)

***

### StartElementEvent

Defined in: [types.ts:66](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L66)

Event fired when an XML element starts

#### Properties

##### type

> **type**: `"START_ELEMENT"`

Defined in: [types.ts:67](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L67)

##### name

> **name**: `string`

Defined in: [types.ts:68](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L68)

##### localName?

> `optional` **localName**: `string`

Defined in: [types.ts:69](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L69)

##### prefix?

> `optional` **prefix**: `string`

Defined in: [types.ts:70](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L70)

##### uri?

> `optional` **uri**: `string`

Defined in: [types.ts:71](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L71)

##### attributes

> **attributes**: `Record`\<`string`, `string`\>

Defined in: [types.ts:72](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L72)

##### attributesWithPrefix?

> `optional` **attributesWithPrefix**: `Record`\<`string`, `AttributeInfo`\>

Defined in: [types.ts:73](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L73)

***

### CharactersEvent

Defined in: [types.ts:84](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L84)

#### Properties

##### type

> **type**: `"CHARACTERS"`

Defined in: [types.ts:85](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L85)

##### value

> **value**: `string`

Defined in: [types.ts:86](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L86)

***

### CdataEvent

Defined in: [types.ts:89](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L89)

#### Properties

##### type

> **type**: `"CDATA"`

Defined in: [types.ts:90](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L90)

##### value

> **value**: `string`

Defined in: [types.ts:91](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L91)

***

### ErrorEvent

Defined in: [types.ts:94](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L94)

#### Properties

##### type

> **type**: `"ERROR"`

Defined in: [types.ts:95](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L95)

##### error

> **error**: `Error`

Defined in: [types.ts:96](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L96)

***

### XmlAttribute

Defined in: [types.ts:114](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L114)

Attribute interface (for Writer)

#### Properties

##### prefix?

> `optional` **prefix**: `string`

Defined in: [types.ts:115](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L115)

##### localName

> **localName**: `string`

Defined in: [types.ts:116](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L116)

##### uri?

> `optional` **uri**: `string`

Defined in: [types.ts:117](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L117)

##### value

> **value**: `string`

Defined in: [types.ts:118](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L118)

***

### WriteElementOptions

Defined in: [types.ts:354](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L354)

Element writing options interface (for Writer)

#### Properties

##### prefix?

> `optional` **prefix**: `string`

Defined in: [types.ts:355](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L355)

##### uri?

> `optional` **uri**: `string`

Defined in: [types.ts:356](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L356)

##### attributes?

> `optional` **attributes**: `Record`\<`string`, `string` \| `AttributeInfo`\>

Defined in: [types.ts:357](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L357)

##### selfClosing?

> `optional` **selfClosing**: `boolean`

Defined in: [types.ts:358](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L358)

##### comment?

> `optional` **comment**: `string`

Defined in: [types.ts:359](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L359)

## Type Aliases

### XmlEventType

> **XmlEventType** = *typeof* [`XmlEventType`](#xmleventtype-1)\[keyof *typeof* [`XmlEventType`](#xmleventtype-1)\]

Defined in: [types.ts:6](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L6)

***

### AnyXmlEvent

> **AnyXmlEvent** = `StartDocumentEvent` \| `EndDocumentEvent` \| [`StartElementEvent`](#startelementevent) \| `EndElementEvent` \| [`CharactersEvent`](#charactersevent) \| [`CdataEvent`](#cdataevent) \| [`ErrorEvent`](#errorevent)

Defined in: [types.ts:102](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L102)

Discriminated Union type for developer use

## Variables

### XmlEventType

> `const` **XmlEventType**: `object`

Defined in: [types.ts:6](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L6)

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

### isStartElement()

> **isStartElement**(`event`): `event is StartElementEvent`

Defined in: [types.ts:297](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L297)

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

Defined in: [types.ts:306](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L306)

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

Defined in: [types.ts:315](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L315)

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

Defined in: [types.ts:323](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L323)

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

Defined in: [types.ts:331](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L331)

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

Defined in: [types.ts:339](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L339)

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

Defined in: [types.ts:347](https://github.com/Clickin/stax-xml/blob/v0.6.0/packages/stax-xml/src/types.ts#L347)

Type guard function - Check if the event is an END_DOCUMENT event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is EndDocumentEvent`

true if the event is an END_DOCUMENT event, false otherwise
