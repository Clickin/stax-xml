---
title: stax-xml
description: API reference for stax-xml
slug: v1.0.0/api/converter
---

**stax-xml**

***

# stax-xml

Declarative XML Converter Module

## Remarks

This module provides a zod-style declarative API for parsing XML documents.
It allows you to define XML schemas using a fluent API and parse XML with XPath support.

## Example

Basic usage:
```typescript
import { x } from 'stax-xml/converter';

const schema = x.object({
  title: x.string().xpath('/book/title'),
  author: x.string().xpath('/book/author'),
  price: x.number().xpath('/book/price')
});

const xml = '<book><title>TypeScript</title><author>John</author><price>29.99</price></book>';
const result = await schema.parse(xml);
// { title: 'TypeScript', author: 'John', price: 29.99 }
```

## Classes

### Writer

Defined in: [Writer.ts:131](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L131)

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

Defined in: [Writer.ts:170](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L170)

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

Defined in: [Writer.ts:292](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L292)

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

Defined in: [Writer.ts:317](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L317)

End document (automatically close all elements)

###### Returns

`Promise`\<`void`\>

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `Promise`\<[`Writer`](#writer)\>

Defined in: [Writer.ts:338](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L338)

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

Defined in: [Writer.ts:430](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L430)

Write end element

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCharacters()

> **writeCharacters**(`text`): `Promise`\<[`Writer`](#writer)\>

Defined in: [Writer.ts:463](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L463)

Write text

###### Parameters

###### text

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCData()

> **writeCData**(`cdata`): `Promise`\<[`Writer`](#writer)\>

Defined in: [Writer.ts:485](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L485)

Write CDATA section

###### Parameters

###### cdata

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeComment()

> **writeComment**(`comment`): `Promise`\<[`Writer`](#writer)\>

Defined in: [Writer.ts:505](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L505)

Write comment

###### Parameters

###### comment

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeRaw()

> **writeRaw**(`xml`): `Promise`\<[`Writer`](#writer)\>

Defined in: [Writer.ts:528](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L528)

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

Defined in: [Writer.ts:537](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L537)

Manual flush

###### Returns

`Promise`\<`void`\>

##### getMetrics()

> **getMetrics**(): `object`

Defined in: [Writer.ts:544](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L544)

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

Defined in: [WriterSync.ts:493](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L493)

String-based sync writer.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSync**(`options?`): [`WriterSync`](#writersync)

Defined in: [WriterSync.ts:496](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L496)

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

Defined in: [WriterSync.ts:78](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L78)

###### Inherited from

`AbstractWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[] = `[]`

Defined in: [WriterSync.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L79)

###### Inherited from

`AbstractWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[] = `[]`

Defined in: [WriterSync.ts:80](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L80)

###### Inherited from

`AbstractWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[] = `[]`

Defined in: [WriterSync.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L81)

###### Inherited from

`AbstractWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[] = `[]`

Defined in: [WriterSync.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L82)

###### Inherited from

`AbstractWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`WriterSyncOptions`](#writersyncoptions)\>

Defined in: [WriterSync.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L83)

###### Inherited from

`AbstractWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number` = `0`

Defined in: [WriterSync.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L84)

###### Inherited from

`AbstractWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean` = `false`

Defined in: [WriterSync.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L85)

###### Inherited from

`AbstractWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: [WriterSync.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L86)

###### Inherited from

`AbstractWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: [WriterSync.ts:133](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L133)

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

Defined in: [WriterSync.ts:158](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L158)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Inherited from

`AbstractWriterSync.writeEndDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: [WriterSync.ts:170](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L170)

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

Defined in: [WriterSync.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L249)

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

Defined in: [WriterSync.ts:259](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L259)

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

Defined in: [WriterSync.ts:276](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L276)

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [WriterSync.ts:290](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L290)

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [WriterSync.ts:307](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L307)

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [WriterSync.ts:322](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L322)

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

Defined in: [WriterSync.ts:344](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L344)

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [WriterSync.ts:350](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L350)

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [WriterSync.ts:382](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L382)

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [WriterSync.ts:387](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L387)

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [WriterSync.ts:393](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L393)

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [WriterSync.ts:397](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L397)

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: [WriterSync.ts:419](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L419)

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: [WriterSync.ts:437](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L437)

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._writeNewline`

##### getXmlString()

> **getXmlString**(): `string`

Defined in: [WriterSync.ts:500](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L500)

###### Returns

`string`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: [WriterSync.ts:504](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L504)

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractWriterSync._emit`

***

### WriterSyncSink

Defined in: [WriterSync.ts:512](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L512)

Sink-based sync writer. Use this for file/buffer incremental writes.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSyncSink**(`sink`, `options?`): [`WriterSyncSink`](#writersyncsink)

Defined in: [WriterSync.ts:520](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L520)

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

Defined in: [WriterSync.ts:78](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L78)

###### Inherited from

`AbstractWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[] = `[]`

Defined in: [WriterSync.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L79)

###### Inherited from

`AbstractWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[] = `[]`

Defined in: [WriterSync.ts:80](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L80)

###### Inherited from

`AbstractWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[] = `[]`

Defined in: [WriterSync.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L81)

###### Inherited from

`AbstractWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[] = `[]`

Defined in: [WriterSync.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L82)

###### Inherited from

`AbstractWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`WriterSyncOptions`](#writersyncoptions)\>

Defined in: [WriterSync.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L83)

###### Inherited from

`AbstractWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number` = `0`

Defined in: [WriterSync.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L84)

###### Inherited from

`AbstractWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean` = `false`

Defined in: [WriterSync.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L85)

###### Inherited from

`AbstractWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: [WriterSync.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L86)

###### Inherited from

`AbstractWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: [WriterSync.ts:133](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L133)

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

Defined in: [WriterSync.ts:170](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L170)

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

Defined in: [WriterSync.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L249)

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

Defined in: [WriterSync.ts:259](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L259)

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

Defined in: [WriterSync.ts:276](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L276)

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [WriterSync.ts:290](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L290)

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [WriterSync.ts:307](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L307)

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [WriterSync.ts:322](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L322)

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

Defined in: [WriterSync.ts:344](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L344)

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [WriterSync.ts:350](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L350)

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [WriterSync.ts:382](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L382)

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [WriterSync.ts:387](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L387)

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [WriterSync.ts:393](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L393)

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [WriterSync.ts:397](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L397)

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: [WriterSync.ts:419](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L419)

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: [WriterSync.ts:437](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L437)

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._writeNewline`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: [WriterSync.ts:536](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L536)

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractWriterSync._emit`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: [WriterSync.ts:577](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L577)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Overrides

`AbstractWriterSync.writeEndDocument`

##### flush()

> **flush**(): `void`

Defined in: [WriterSync.ts:585](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L585)

###### Returns

`void`

##### close()

> **close**(): `void`

Defined in: [WriterSync.ts:592](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L592)

###### Returns

`void`

***

### XmlArraySchema

Defined in: [converter/XmlArraySchema.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L16)

Schema for parsing XML array values

#### Extends

- [`XmlSchemaBase`](#abstract-xmlschemabase)\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

#### Type Parameters

##### T

`T` *extends* [`XmlSchemaBase`](#abstract-xmlschemabase)\<`unknown`, `unknown`\>

#### Constructors

##### Constructor

> **new XmlArraySchema**\<`T`\>(`element`, `xpath?`): [`XmlArraySchema`](#xmlarrayschema)\<`T`\>

Defined in: [converter/XmlArraySchema.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L19)

###### Parameters

###### element

`T`

###### xpath?

`string`

###### Returns

[`XmlArraySchema`](#xmlarrayschema)\<`T`\>

###### Overrides

[`XmlSchemaBase`](#abstract-xmlschemabase).[`constructor`](#constructor-11)

#### Properties

##### element

> `readonly` **element**: `T`

Defined in: [converter/XmlArraySchema.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L20)

##### xpath?

> `readonly` `optional` **xpath?**: `string`

Defined in: [converter/XmlArraySchema.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L21)

##### \_output

> `readonly` **\_output**: `T`\[`"_output"`\][]

Defined in: [converter/base.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L31)

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_output`](#_output-7)

##### \_input

> `readonly` **\_input**: `T`\[`"_input"`\][]

Defined in: [converter/base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L32)

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_input`](#_input-7)

#### Methods

##### \_parse()

> **\_parse**(`input`, `parseOptions?`): `T`\[`"_output"`\][]

Defined in: [converter/XmlArraySchema.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L26)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, byte view, or sync iterator

###### parseOptions?

[`ParseOptions`](#parseoptions)

###### Returns

`T`\[`"_output"`\][]

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_parse`](#_parse-7)

##### \_parseAsync()

> **\_parseAsync**(`input`, `parseOptions?`): `Promise`\<`T`\[`"_output"`\][]\>

Defined in: [converter/XmlArraySchema.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L31)

Parse XML input asynchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### parseOptions?

[`ParseOptions`](#parseoptions)

###### Returns

`Promise`\<`T`\[`"_output"`\][]\>

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_parseAsync`](#_parseasync-7)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`T`\[`"_output"`\][]\>

Defined in: [converter/base.ts:117](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L117)

Parse XML asynchronously (public API)

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`T`\[`"_output"`\][]\>

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`parse`](#parse-7)

##### parseSync()

> **parseSync**(`input`, `options?`): `T`\[`"_output"`\][]

Defined in: [converter/base.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L135)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`T`\[`"_output"`\][]

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`parseSync`](#parsesync-7)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`T`\[`"_output"`\][]\>\>

Defined in: [converter/base.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L152)

Parse XML asynchronously with error handling

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<[`ParseResult`](#parseresult)\<`T`\[`"_output"`\][]\>\>

Parse result with success flag

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`safeParse`](#safeparse-7)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`T`\[`"_output"`\][]\>

Defined in: [converter/base.ts:173](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L173)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`T`\[`"_output"`\][]\>

Parse result with success flag

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`safeParseSync`](#safeparsesync-7)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `T`\[`"_input"`\][]\>

Defined in: [converter/base.ts:193](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L193)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `T`\[`"_input"`\][]\>

New schema with transform applied

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`transform`](#transform-7)

##### optional()

> **optional**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`T`\[`"_output"`\][] \| `undefined`, `T`\[`"_input"`\][] \| `undefined`\>

Defined in: [converter/base.ts:201](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L201)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`T`\[`"_output"`\][] \| `undefined`, `T`\[`"_input"`\][] \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`optional`](#optional-7)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`T`\[`"_output"`\][][], `T`\[`"_input"`\][][]\>

Defined in: [converter/base.ts:210](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L210)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`T`\[`"_output"`\][][], `T`\[`"_input"`\][][]\>

New array schema

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`array`](#array-8)

##### compile()

> **compile**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [converter/base.ts:238](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L238)

Compile this schema for repeated parsing.

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

New compiled schema

###### Remarks

`compile()` preserves the public parsing API and can speed up schemas that can
be lowered to fixed XML event dispatch. The optimized path works best when the
root schema is an object, array, string, or number with static XPath selectors.

Fast-path friendly selectors use absolute paths such as `/catalog/book`,
descendant paths such as `//book`, and relative selectors inside object or
array items such as `./title`, `./@id`, `./name/text()`, or `./name/@code`.
Object fields, arrays of scalar values, arrays of objects, nested objects,
optional fields, and transforms are supported.

Selectors with wildcards or predicates, ambiguous relative paths such as
`title`, nested arrays, and arrays that combine an array XPath with an element
XPath are parsed with the normal runtime converter path instead. This keeps
behavior compatible, but does not get the dispatch fast path.

Call `compile()` once on the root schema and reuse the returned schema.
Non-object root schemas need an XPath.

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`compile`](#compile-7)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [converter/base.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L249)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`T`\[`"_output"`\][]

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`write`](#write-8)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [converter/base.ts:272](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L272)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`T`\[`"_output"`\][]

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`writeToStream`](#writetostream-7)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [converter/base.ts:286](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L286)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`T`\[`"_output"`\][]

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`string`

XML string

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`writeSync`](#writesync-7)

##### writer()

> **writer**(`config`): `this`

Defined in: [converter/base.ts:295](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L295)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`writer`](#writer-8)

***

### XmlBuilder

Defined in: [converter/XmlBuilder.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L13)

Builder API for creating XML schemas

#### Constructors

##### Constructor

> **new XmlBuilder**(): [`XmlBuilder`](#xmlbuilder)

###### Returns

[`XmlBuilder`](#xmlbuilder)

#### Methods

##### string()

> **string**(`xpath?`): [`XmlStringSchema`](#xmlstringschema)

Defined in: [converter/XmlBuilder.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L19)

Create a string schema

###### Parameters

###### xpath?

`string`

Optional XPath expression

###### Returns

[`XmlStringSchema`](#xmlstringschema)

String schema

##### number()

> **number**(`xpath?`): [`XmlNumberSchema`](#xmlnumberschema)

Defined in: [converter/XmlBuilder.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L28)

Create a number schema

###### Parameters

###### xpath?

`string`

Optional XPath expression

###### Returns

[`XmlNumberSchema`](#xmlnumberschema)

Number schema

##### object()

> **object**\<`T`\>(`shape`, `options?`): [`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

Defined in: [converter/XmlBuilder.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L38)

Create an object schema

###### Type Parameters

###### T

`T` *extends* [`XmlObjectShape`](#xmlobjectshape)

###### Parameters

###### shape

`T`

Object shape definition

###### options?

[`XmlObjectOptions`](#xmlobjectoptions)

Optional object options

###### Returns

[`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

Object schema

##### array()

> **array**\<`T`\>(`element`, `xpath?`): [`XmlArraySchema`](#xmlarrayschema)\<`T`\>

Defined in: [converter/XmlBuilder.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L48)

Create an array schema

###### Type Parameters

###### T

`T` *extends* [`XmlSchema`](#abstract-xmlschema)\<`unknown`, `unknown`\>

###### Parameters

###### element

`T`

Element schema

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlArraySchema`](#xmlarrayschema)\<`T`\>

Array schema

***

### XmlNumberSchema

Defined in: [converter/XmlNumberSchema.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L16)

Schema for parsing XML number values

#### Extends

- [`XmlSchema`](#abstract-xmlschema)\<`number`, `number`\>

#### Constructors

##### Constructor

> **new XmlNumberSchema**(`options?`): [`XmlNumberSchema`](#xmlnumberschema)

Defined in: [converter/XmlNumberSchema.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L19)

###### Parameters

###### options?

[`XmlNumberOptions`](#xmlnumberoptions) = `{}`

###### Returns

[`XmlNumberSchema`](#xmlnumberschema)

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`constructor`](#constructor-8)

#### Properties

##### options

> **options**: [`XmlNumberOptions`](#xmlnumberoptions) = `{}`

Defined in: [converter/XmlNumberSchema.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L19)

##### \_output

> `readonly` **\_output**: `number`

Defined in: [converter/base.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L31)

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_output`](#_output-4)

##### \_input

> `readonly` **\_input**: `number`

Defined in: [converter/base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L32)

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_input`](#_input-4)

#### Methods

##### \_parse()

> **\_parse**(`input`, `parseOptions?`): `number`

Defined in: [converter/XmlNumberSchema.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L23)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, byte view, or sync iterator

###### parseOptions?

[`ParseOptions`](#parseoptions)

###### Returns

`number`

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`_parse`](#_parse-4)

##### \_parseAsync()

> **\_parseAsync**(`input`, `parseOptions?`): `Promise`\<`number`\>

Defined in: [converter/XmlNumberSchema.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L29)

Parse XML input asynchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### parseOptions?

[`ParseOptions`](#parseoptions)

###### Returns

`Promise`\<`number`\>

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`_parseAsync`](#_parseasync-4)

##### xpath()

> **xpath**(`path`): [`XmlNumberSchema`](#xmlnumberschema)

Defined in: [converter/XmlNumberSchema.ts:158](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L158)

Set XPath expression for locating the element

###### Parameters

###### path

`string`

XPath expression

###### Returns

[`XmlNumberSchema`](#xmlnumberschema)

New schema with XPath

##### min()

> **min**(`value`): [`XmlNumberSchema`](#xmlnumberschema)

Defined in: [converter/XmlNumberSchema.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L171)

Set minimum value

###### Parameters

###### value

`number`

Minimum value

###### Returns

[`XmlNumberSchema`](#xmlnumberschema)

New schema with minimum

##### max()

> **max**(`value`): [`XmlNumberSchema`](#xmlnumberschema)

Defined in: [converter/XmlNumberSchema.ts:180](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L180)

Set maximum value

###### Parameters

###### value

`number`

Maximum value

###### Returns

[`XmlNumberSchema`](#xmlnumberschema)

New schema with maximum

##### int()

> **int**(): [`XmlNumberSchema`](#xmlnumberschema)

Defined in: [converter/XmlNumberSchema.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L188)

Require integer value

###### Returns

[`XmlNumberSchema`](#xmlnumberschema)

New schema that only accepts integers

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`number`\>

Defined in: [converter/base.ts:117](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L117)

Parse XML asynchronously (public API)

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`number`\>

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`parse`](#parse-4)

##### parseSync()

> **parseSync**(`input`, `options?`): `number`

Defined in: [converter/base.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L135)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`number`

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`parseSync`](#parsesync-4)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`number`\>\>

Defined in: [converter/base.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L152)

Parse XML asynchronously with error handling

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<[`ParseResult`](#parseresult)\<`number`\>\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`safeParse`](#safeparse-4)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`number`\>

Defined in: [converter/base.ts:173](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L173)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`number`\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`safeParseSync`](#safeparsesync-4)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `number`\>

Defined in: [converter/base.ts:193](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L193)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `number`\>

New schema with transform applied

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`transform`](#transform-4)

##### optional()

> **optional**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`number` \| `undefined`, `number` \| `undefined`\>

Defined in: [converter/base.ts:201](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L201)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`number` \| `undefined`, `number` \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`optional`](#optional-4)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`number`[], `number`[]\>

Defined in: [converter/base.ts:210](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L210)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`number`[], `number`[]\>

New array schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`array`](#array-5)

##### compile()

> **compile**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`number`, `number`\>

Defined in: [converter/base.ts:238](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L238)

Compile this schema for repeated parsing.

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`number`, `number`\>

New compiled schema

###### Remarks

`compile()` preserves the public parsing API and can speed up schemas that can
be lowered to fixed XML event dispatch. The optimized path works best when the
root schema is an object, array, string, or number with static XPath selectors.

Fast-path friendly selectors use absolute paths such as `/catalog/book`,
descendant paths such as `//book`, and relative selectors inside object or
array items such as `./title`, `./@id`, `./name/text()`, or `./name/@code`.
Object fields, arrays of scalar values, arrays of objects, nested objects,
optional fields, and transforms are supported.

Selectors with wildcards or predicates, ambiguous relative paths such as
`title`, nested arrays, and arrays that combine an array XPath with an element
XPath are parsed with the normal runtime converter path instead. This keeps
behavior compatible, but does not get the dispatch fast path.

Call `compile()` once on the root schema and reuse the returned schema.
Non-object root schemas need an XPath.

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`compile`](#compile-4)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [converter/base.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L249)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`number`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`write`](#write-5)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [converter/base.ts:272](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L272)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`number`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writeToStream`](#writetostream-4)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [converter/base.ts:286](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L286)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`number`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`string`

XML string

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writeSync`](#writesync-4)

##### writer()

> **writer**(`config`): `this`

Defined in: [converter/base.ts:295](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L295)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writer`](#writer-5)

***

### XmlObjectSchema

Defined in: [converter/XmlObjectSchema.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L58)

Schema for parsing XML object values

#### Extends

- [`XmlSchema`](#abstract-xmlschema)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>, `unknown`\>

#### Type Parameters

##### T

`T` *extends* [`XmlObjectShape`](#xmlobjectshape)

#### Constructors

##### Constructor

> **new XmlObjectSchema**\<`T`\>(`shape`, `options?`): [`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

Defined in: [converter/XmlObjectSchema.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L61)

###### Parameters

###### shape

`T`

###### options?

[`XmlObjectOptions`](#xmlobjectoptions) = `{}`

###### Returns

[`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`constructor`](#constructor-8)

#### Properties

##### shape

> `readonly` **shape**: `T`

Defined in: [converter/XmlObjectSchema.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L62)

##### options

> **options**: [`XmlObjectOptions`](#xmlobjectoptions) = `{}`

Defined in: [converter/XmlObjectSchema.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L63)

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [converter/base.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L31)

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_output`](#_output-4)

##### \_input

> `readonly` **\_input**: `unknown`

Defined in: [converter/base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L32)

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_input`](#_input-4)

#### Methods

##### \_parse()

> **\_parse**(`input`, `parseOptions?`): [`InferObjectOutput`](#inferobjectoutput)\<`T`\>

Defined in: [converter/XmlObjectSchema.ts:68](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L68)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, byte view, or sync iterator

###### parseOptions?

[`ParseOptions`](#parseoptions)

###### Returns

[`InferObjectOutput`](#inferobjectoutput)\<`T`\>

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`_parse`](#_parse-4)

##### \_parseAsync()

> **\_parseAsync**(`input`, `parseOptions?`): `Promise`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Defined in: [converter/XmlObjectSchema.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L73)

Parse XML input asynchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### parseOptions?

[`ParseOptions`](#parseoptions)

###### Returns

`Promise`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`_parseAsync`](#_parseasync-4)

##### xpath()

> **xpath**(`path`): [`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

Defined in: [converter/XmlObjectSchema.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L126)

Set XPath expression for locating the object

###### Parameters

###### path

`string`

XPath expression

###### Returns

[`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

New schema with XPath

##### parse()

> **parse**(`input`, `options?`): `Promise`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Defined in: [converter/base.ts:117](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L117)

Parse XML asynchronously (public API)

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`parse`](#parse-4)

##### parseSync()

> **parseSync**(`input`, `options?`): `Output`

Defined in: [converter/base.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L135)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output`

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`parseSync`](#parsesync-4)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>\>

Defined in: [converter/base.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L152)

Parse XML asynchronously with error handling

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<[`ParseResult`](#parseresult)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`safeParse`](#safeparse-4)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Defined in: [converter/base.ts:173](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L173)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`safeParseSync`](#safeparsesync-4)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `unknown`\>

Defined in: [converter/base.ts:193](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L193)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `unknown`\>

New schema with transform applied

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`transform`](#transform-4)

##### optional()

> **optional**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\> \| `undefined`, `unknown`\>

Defined in: [converter/base.ts:201](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L201)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\> \| `undefined`, `unknown`\>

New optional schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`optional`](#optional-4)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>[], `unknown`[]\>

Defined in: [converter/base.ts:210](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L210)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>[], `unknown`[]\>

New array schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`array`](#array-5)

##### compile()

> **compile**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>, `unknown`\>

Defined in: [converter/base.ts:238](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L238)

Compile this schema for repeated parsing.

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>, `unknown`\>

New compiled schema

###### Remarks

`compile()` preserves the public parsing API and can speed up schemas that can
be lowered to fixed XML event dispatch. The optimized path works best when the
root schema is an object, array, string, or number with static XPath selectors.

Fast-path friendly selectors use absolute paths such as `/catalog/book`,
descendant paths such as `//book`, and relative selectors inside object or
array items such as `./title`, `./@id`, `./name/text()`, or `./name/@code`.
Object fields, arrays of scalar values, arrays of objects, nested objects,
optional fields, and transforms are supported.

Selectors with wildcards or predicates, ambiguous relative paths such as
`title`, nested arrays, and arrays that combine an array XPath with an element
XPath are parsed with the normal runtime converter path instead. This keeps
behavior compatible, but does not get the dispatch fast path.

Call `compile()` once on the root schema and reuse the returned schema.
Non-object root schemas need an XPath.

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`compile`](#compile-4)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [converter/base.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L249)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`write`](#write-5)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [converter/base.ts:272](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L272)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writeToStream`](#writetostream-4)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [converter/base.ts:286](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L286)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`string`

XML string

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writeSync`](#writesync-4)

##### writer()

> **writer**(`config`): `this`

Defined in: [converter/base.ts:295](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L295)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writer`](#writer-5)

***

### XmlOptionalSchema

Defined in: [converter/XmlOptionalSchema.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L10)

Schema for optional values

#### Extends

- [`XmlSchemaBase`](#abstract-xmlschemabase)\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

#### Type Parameters

##### T

`T` *extends* [`XmlSchemaBase`](#abstract-xmlschemabase)\<`unknown`, `unknown`\>

#### Constructors

##### Constructor

> **new XmlOptionalSchema**\<`T`\>(`schema`): [`XmlOptionalSchema`](#xmloptionalschema)\<`T`\>

Defined in: [converter/XmlOptionalSchema.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L13)

###### Parameters

###### schema

`T`

###### Returns

[`XmlOptionalSchema`](#xmloptionalschema)\<`T`\>

###### Overrides

[`XmlSchemaBase`](#abstract-xmlschemabase).[`constructor`](#constructor-11)

#### Properties

##### schema

> `readonly` **schema**: `T`

Defined in: [converter/XmlOptionalSchema.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L13)

##### \_output

> `readonly` **\_output**: `T`\[`"_output"`\] \| `undefined`

Defined in: [converter/base.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L31)

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_output`](#_output-7)

##### \_input

> `readonly` **\_input**: `T`\[`"_input"`\] \| `undefined`

Defined in: [converter/base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L32)

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_input`](#_input-7)

#### Methods

##### \_parse()

> **\_parse**(`input`, `options?`): `T`\[`"_output"`\] \| `undefined`

Defined in: [converter/XmlOptionalSchema.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L17)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`T`\[`"_output"`\] \| `undefined`

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_parse`](#_parse-7)

##### \_parseAsync()

> **\_parseAsync**(`input`, `options?`): `Promise`\<`T`\[`"_output"`\] \| `undefined`\>

Defined in: [converter/XmlOptionalSchema.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L30)

Parse XML input asynchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`T`\[`"_output"`\] \| `undefined`\>

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_parseAsync`](#_parseasync-7)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`T`\[`"_output"`\] \| `undefined`\>

Defined in: [converter/base.ts:117](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L117)

Parse XML asynchronously (public API)

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`T`\[`"_output"`\] \| `undefined`\>

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`parse`](#parse-7)

##### parseSync()

> **parseSync**(`input`, `options?`): `T`\[`"_output"`\] \| `undefined`

Defined in: [converter/base.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L135)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`T`\[`"_output"`\] \| `undefined`

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`parseSync`](#parsesync-7)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`T`\[`"_output"`\] \| `undefined`\>\>

Defined in: [converter/base.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L152)

Parse XML asynchronously with error handling

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<[`ParseResult`](#parseresult)\<`T`\[`"_output"`\] \| `undefined`\>\>

Parse result with success flag

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`safeParse`](#safeparse-7)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`T`\[`"_output"`\] \| `undefined`\>

Defined in: [converter/base.ts:173](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L173)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`T`\[`"_output"`\] \| `undefined`\>

Parse result with success flag

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`safeParseSync`](#safeparsesync-7)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [converter/base.ts:193](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L193)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `T`\[`"_input"`\] \| `undefined`\>

New schema with transform applied

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`transform`](#transform-7)

##### optional()

> **optional**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [converter/base.ts:201](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L201)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`optional`](#optional-7)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<(`T`\[`"_output"`\] \| `undefined`)[], (`T`\[`"_input"`\] \| `undefined`)[]\>

Defined in: [converter/base.ts:210](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L210)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<(`T`\[`"_output"`\] \| `undefined`)[], (`T`\[`"_input"`\] \| `undefined`)[]\>

New array schema

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`array`](#array-8)

##### compile()

> **compile**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [converter/base.ts:238](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L238)

Compile this schema for repeated parsing.

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

New compiled schema

###### Remarks

`compile()` preserves the public parsing API and can speed up schemas that can
be lowered to fixed XML event dispatch. The optimized path works best when the
root schema is an object, array, string, or number with static XPath selectors.

Fast-path friendly selectors use absolute paths such as `/catalog/book`,
descendant paths such as `//book`, and relative selectors inside object or
array items such as `./title`, `./@id`, `./name/text()`, or `./name/@code`.
Object fields, arrays of scalar values, arrays of objects, nested objects,
optional fields, and transforms are supported.

Selectors with wildcards or predicates, ambiguous relative paths such as
`title`, nested arrays, and arrays that combine an array XPath with an element
XPath are parsed with the normal runtime converter path instead. This keeps
behavior compatible, but does not get the dispatch fast path.

Call `compile()` once on the root schema and reuse the returned schema.
Non-object root schemas need an XPath.

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`compile`](#compile-7)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [converter/base.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L249)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`T`\[`"_output"`\] \| `undefined`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`write`](#write-8)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [converter/base.ts:272](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L272)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`T`\[`"_output"`\] \| `undefined`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`writeToStream`](#writetostream-7)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [converter/base.ts:286](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L286)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`T`\[`"_output"`\] \| `undefined`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`string`

XML string

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`writeSync`](#writesync-7)

##### writer()

> **writer**(`config`): `this`

Defined in: [converter/base.ts:295](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L295)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`writer`](#writer-8)

***

### `abstract` XmlSchema

Defined in: [converter/XmlSchema.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlSchema.ts#L10)

Main XML schema class (extends XmlSchemaBase with all methods)

#### Extends

- [`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`, `Input`\>

#### Extended by

- [`XmlStringSchema`](#xmlstringschema)
- [`XmlNumberSchema`](#xmlnumberschema)
- [`XmlObjectSchema`](#xmlobjectschema)

#### Type Parameters

##### Output

`Output`

##### Input

`Input` = `Output`

#### Constructors

##### Constructor

> **new XmlSchema**\<`Output`, `Input`\>(): [`XmlSchema`](#abstract-xmlschema)\<`Output`, `Input`\>

###### Returns

[`XmlSchema`](#abstract-xmlschema)\<`Output`, `Input`\>

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`constructor`](#constructor-11)

#### Properties

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [converter/base.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L31)

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_output`](#_output-7)

##### \_input

> `readonly` **\_input**: `Input`

Defined in: [converter/base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L32)

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_input`](#_input-7)

#### Methods

##### \_parse()

> `abstract` **\_parse**(`input`, `options?`): `Output`

Defined in: [converter/base.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L53)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output`

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_parse`](#_parse-7)

##### \_parseAsync()

> `abstract` **\_parseAsync**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [converter/base.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L62)

Parse XML input asynchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`Output`\>

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_parseAsync`](#_parseasync-7)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [converter/base.ts:117](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L117)

Parse XML asynchronously (public API)

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`Output`\>

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`parse`](#parse-7)

##### parseSync()

> **parseSync**(`input`, `options?`): `Output`

Defined in: [converter/base.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L135)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output`

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`parseSync`](#parsesync-7)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Defined in: [converter/base.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L152)

Parse XML asynchronously with error handling

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Parse result with success flag

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`safeParse`](#safeparse-7)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`Output`\>

Defined in: [converter/base.ts:173](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L173)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`Output`\>

Parse result with success flag

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`safeParseSync`](#safeparsesync-7)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `Input`\>

Defined in: [converter/base.ts:193](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L193)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `Input`\>

New schema with transform applied

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`transform`](#transform-7)

##### optional()

> **optional**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output` \| `undefined`, `Input` \| `undefined`\>

Defined in: [converter/base.ts:201](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L201)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output` \| `undefined`, `Input` \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`optional`](#optional-7)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`[], `Input`[]\>

Defined in: [converter/base.ts:210](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L210)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`[], `Input`[]\>

New array schema

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`array`](#array-8)

##### compile()

> **compile**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`, `Input`\>

Defined in: [converter/base.ts:238](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L238)

Compile this schema for repeated parsing.

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`, `Input`\>

New compiled schema

###### Remarks

`compile()` preserves the public parsing API and can speed up schemas that can
be lowered to fixed XML event dispatch. The optimized path works best when the
root schema is an object, array, string, or number with static XPath selectors.

Fast-path friendly selectors use absolute paths such as `/catalog/book`,
descendant paths such as `//book`, and relative selectors inside object or
array items such as `./title`, `./@id`, `./name/text()`, or `./name/@code`.
Object fields, arrays of scalar values, arrays of objects, nested objects,
optional fields, and transforms are supported.

Selectors with wildcards or predicates, ambiguous relative paths such as
`title`, nested arrays, and arrays that combine an array XPath with an element
XPath are parsed with the normal runtime converter path instead. This keeps
behavior compatible, but does not get the dispatch fast path.

Call `compile()` once on the root schema and reuse the returned schema.
Non-object root schemas need an XPath.

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`compile`](#compile-7)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [converter/base.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L249)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`write`](#write-8)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [converter/base.ts:272](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L272)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`writeToStream`](#writetostream-7)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [converter/base.ts:286](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L286)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`string`

XML string

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`writeSync`](#writesync-7)

##### writer()

> **writer**(`config`): `this`

Defined in: [converter/base.ts:295](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L295)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`writer`](#writer-8)

***

### XmlStringSchema

Defined in: [converter/XmlStringSchema.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L27)

Schema for parsing XML string values

#### Extends

- [`XmlSchema`](#abstract-xmlschema)\<`string`, `string`\>

#### Constructors

##### Constructor

> **new XmlStringSchema**(`options?`): [`XmlStringSchema`](#xmlstringschema)

Defined in: [converter/XmlStringSchema.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L30)

###### Parameters

###### options?

[`XmlStringOptions`](#xmlstringoptions) = `{}`

###### Returns

[`XmlStringSchema`](#xmlstringschema)

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`constructor`](#constructor-8)

#### Properties

##### options

> **options**: [`XmlStringOptions`](#xmlstringoptions) = `{}`

Defined in: [converter/XmlStringSchema.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L30)

##### \_output

> `readonly` **\_output**: `string`

Defined in: [converter/base.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L31)

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_output`](#_output-4)

##### \_input

> `readonly` **\_input**: `string`

Defined in: [converter/base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L32)

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_input`](#_input-4)

#### Methods

##### \_parse()

> **\_parse**(`input`, `parseOptions?`): `string`

Defined in: [converter/XmlStringSchema.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L34)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, byte view, or sync iterator

###### parseOptions?

[`ParseOptions`](#parseoptions)

###### Returns

`string`

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`_parse`](#_parse-4)

##### \_parseAsync()

> **\_parseAsync**(`input`, `parseOptions?`): `Promise`\<`string`\>

Defined in: [converter/XmlStringSchema.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L39)

Parse XML input asynchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### parseOptions?

[`ParseOptions`](#parseoptions)

###### Returns

`Promise`\<`string`\>

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`_parseAsync`](#_parseasync-4)

##### xpath()

> **xpath**(`path`): [`XmlStringSchema`](#xmlstringschema)

Defined in: [converter/XmlStringSchema.ts:123](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L123)

Set XPath expression for locating the element

###### Parameters

###### path

`string`

XPath expression

###### Returns

[`XmlStringSchema`](#xmlstringschema)

New schema with XPath

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`string`\>

Defined in: [converter/base.ts:117](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L117)

Parse XML asynchronously (public API)

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`string`\>

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`parse`](#parse-4)

##### parseSync()

> **parseSync**(`input`, `options?`): `string`

Defined in: [converter/base.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L135)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`string`

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`parseSync`](#parsesync-4)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`string`\>\>

Defined in: [converter/base.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L152)

Parse XML asynchronously with error handling

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<[`ParseResult`](#parseresult)\<`string`\>\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`safeParse`](#safeparse-4)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`string`\>

Defined in: [converter/base.ts:173](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L173)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`string`\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`safeParseSync`](#safeparsesync-4)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `string`\>

Defined in: [converter/base.ts:193](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L193)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `string`\>

New schema with transform applied

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`transform`](#transform-4)

##### optional()

> **optional**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`string` \| `undefined`, `string` \| `undefined`\>

Defined in: [converter/base.ts:201](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L201)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`string` \| `undefined`, `string` \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`optional`](#optional-4)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`string`[], `string`[]\>

Defined in: [converter/base.ts:210](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L210)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`string`[], `string`[]\>

New array schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`array`](#array-5)

##### compile()

> **compile**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`string`, `string`\>

Defined in: [converter/base.ts:238](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L238)

Compile this schema for repeated parsing.

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`string`, `string`\>

New compiled schema

###### Remarks

`compile()` preserves the public parsing API and can speed up schemas that can
be lowered to fixed XML event dispatch. The optimized path works best when the
root schema is an object, array, string, or number with static XPath selectors.

Fast-path friendly selectors use absolute paths such as `/catalog/book`,
descendant paths such as `//book`, and relative selectors inside object or
array items such as `./title`, `./@id`, `./name/text()`, or `./name/@code`.
Object fields, arrays of scalar values, arrays of objects, nested objects,
optional fields, and transforms are supported.

Selectors with wildcards or predicates, ambiguous relative paths such as
`title`, nested arrays, and arrays that combine an array XPath with an element
XPath are parsed with the normal runtime converter path instead. This keeps
behavior compatible, but does not get the dispatch fast path.

Call `compile()` once on the root schema and reuse the returned schema.
Non-object root schemas need an XPath.

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`compile`](#compile-4)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [converter/base.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L249)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`string`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`write`](#write-5)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [converter/base.ts:272](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L272)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`string`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writeToStream`](#writetostream-4)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [converter/base.ts:286](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L286)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`string`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`string`

XML string

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writeSync`](#writesync-4)

##### writer()

> **writer**(`config`): `this`

Defined in: [converter/base.ts:295](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L295)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writer`](#writer-5)

***

### XmlTransformSchema

Defined in: [converter/XmlTransformSchema.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L11)

Schema for transforming parsed values

#### Extends

- [`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`, `Input`\>

#### Type Parameters

##### Output

`Output`

##### Input

`Input`

##### IntermediateOutput

`IntermediateOutput` = `unknown`

#### Constructors

##### Constructor

> **new XmlTransformSchema**\<`Output`, `Input`, `IntermediateOutput`\>(`schema`, `transformFn`): [`XmlTransformSchema`](#xmltransformschema)\<`Output`, `Input`, `IntermediateOutput`\>

Defined in: [converter/XmlTransformSchema.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L19)

###### Parameters

###### schema

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`IntermediateOutput`, `Input`\>

###### transformFn

(`value`) => `Output`

###### Returns

[`XmlTransformSchema`](#xmltransformschema)\<`Output`, `Input`, `IntermediateOutput`\>

###### Overrides

[`XmlSchemaBase`](#abstract-xmlschemabase).[`constructor`](#constructor-11)

#### Properties

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [converter/base.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L31)

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_output`](#_output-7)

##### \_input

> `readonly` **\_input**: `Input`

Defined in: [converter/base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L32)

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_input`](#_input-7)

#### Methods

##### \_parse()

> **\_parse**(`input`, `options?`): `Output`

Defined in: [converter/XmlTransformSchema.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L28)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output`

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_parse`](#_parse-7)

##### \_parseAsync()

> **\_parseAsync**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [converter/XmlTransformSchema.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L33)

Parse XML input asynchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`Output`\>

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchemaBase`](#abstract-xmlschemabase).[`_parseAsync`](#_parseasync-7)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [converter/base.ts:117](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L117)

Parse XML asynchronously (public API)

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`Output`\>

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`parse`](#parse-7)

##### parseSync()

> **parseSync**(`input`, `options?`): `Output`

Defined in: [converter/base.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L135)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output`

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`parseSync`](#parsesync-7)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Defined in: [converter/base.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L152)

Parse XML asynchronously with error handling

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Parse result with success flag

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`safeParse`](#safeparse-7)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`Output`\>

Defined in: [converter/base.ts:173](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L173)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`Output`\>

Parse result with success flag

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`safeParseSync`](#safeparsesync-7)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `Input`\>

Defined in: [converter/base.ts:193](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L193)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `Input`\>

New schema with transform applied

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`transform`](#transform-7)

##### optional()

> **optional**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output` \| `undefined`, `Input` \| `undefined`\>

Defined in: [converter/base.ts:201](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L201)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output` \| `undefined`, `Input` \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`optional`](#optional-7)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`[], `Input`[]\>

Defined in: [converter/base.ts:210](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L210)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`[], `Input`[]\>

New array schema

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`array`](#array-8)

##### compile()

> **compile**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`, `Input`\>

Defined in: [converter/base.ts:238](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L238)

Compile this schema for repeated parsing.

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`, `Input`\>

New compiled schema

###### Remarks

`compile()` preserves the public parsing API and can speed up schemas that can
be lowered to fixed XML event dispatch. The optimized path works best when the
root schema is an object, array, string, or number with static XPath selectors.

Fast-path friendly selectors use absolute paths such as `/catalog/book`,
descendant paths such as `//book`, and relative selectors inside object or
array items such as `./title`, `./@id`, `./name/text()`, or `./name/@code`.
Object fields, arrays of scalar values, arrays of objects, nested objects,
optional fields, and transforms are supported.

Selectors with wildcards or predicates, ambiguous relative paths such as
`title`, nested arrays, and arrays that combine an array XPath with an element
XPath are parsed with the normal runtime converter path instead. This keeps
behavior compatible, but does not get the dispatch fast path.

Call `compile()` once on the root schema and reuse the returned schema.
Non-object root schemas need an XPath.

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`compile`](#compile-7)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [converter/base.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L249)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`write`](#write-8)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [converter/base.ts:272](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L272)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`writeToStream`](#writetostream-7)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [converter/base.ts:286](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L286)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`string`

XML string

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`writeSync`](#writesync-7)

##### writer()

> **writer**(`config`): `this`

Defined in: [converter/base.ts:295](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L295)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchemaBase`](#abstract-xmlschemabase).[`writer`](#writer-8)

***

### `abstract` XmlSchemaBase

Defined in: [converter/base.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L30)

Base abstract class for all XML schema types

#### Remarks

This class provides the foundation for zod-style declarative XML parsing.
Each schema type extends this class and implements the parsing logic.

#### Extended by

- [`XmlSchema`](#abstract-xmlschema)
- [`XmlArraySchema`](#xmlarrayschema)
- [`XmlOptionalSchema`](#xmloptionalschema)
- [`XmlTransformSchema`](#xmltransformschema)

#### Type Parameters

##### Output

`Output`

##### Input

`Input` = `Output`

#### Constructors

##### Constructor

> **new XmlSchemaBase**\<`Output`, `Input`\>(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`, `Input`\>

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`, `Input`\>

#### Properties

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [converter/base.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L31)

##### \_input

> `readonly` **\_input**: `Input`

Defined in: [converter/base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L32)

#### Methods

##### \_parse()

> `abstract` **\_parse**(`input`, `options?`): `Output`

Defined in: [converter/base.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L53)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output`

Parsed output

###### Throws

If parsing fails

##### \_parseAsync()

> `abstract` **\_parseAsync**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [converter/base.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L62)

Parse XML input asynchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`Output`\>

Parsed output

###### Throws

If parsing fails

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [converter/base.ts:117](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L117)

Parse XML asynchronously (public API)

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`Output`\>

Parsed output

###### Throws

If parsing fails

##### parseSync()

> **parseSync**(`input`, `options?`): `Output`

Defined in: [converter/base.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L135)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output`

Parsed output

###### Throws

If parsing fails

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Defined in: [converter/base.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L152)

Parse XML asynchronously with error handling

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Parse result with success flag

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`Output`\>

Defined in: [converter/base.ts:173](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L173)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent), `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`Output`\>

Parse result with success flag

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `Input`\>

Defined in: [converter/base.ts:193](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L193)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`NewOutput`, `Input`\>

New schema with transform applied

##### optional()

> **optional**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output` \| `undefined`, `Input` \| `undefined`\>

Defined in: [converter/base.ts:201](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L201)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output` \| `undefined`, `Input` \| `undefined`\>

New optional schema

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`[], `Input`[]\>

Defined in: [converter/base.ts:210](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L210)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`[], `Input`[]\>

New array schema

##### compile()

> **compile**(): [`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`, `Input`\>

Defined in: [converter/base.ts:238](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L238)

Compile this schema for repeated parsing.

###### Returns

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`Output`, `Input`\>

New compiled schema

###### Remarks

`compile()` preserves the public parsing API and can speed up schemas that can
be lowered to fixed XML event dispatch. The optimized path works best when the
root schema is an object, array, string, or number with static XPath selectors.

Fast-path friendly selectors use absolute paths such as `/catalog/book`,
descendant paths such as `//book`, and relative selectors inside object or
array items such as `./title`, `./@id`, `./name/text()`, or `./name/@code`.
Object fields, arrays of scalar values, arrays of objects, nested objects,
optional fields, and transforms are supported.

Selectors with wildcards or predicates, ambiguous relative paths such as
`title`, nested arrays, and arrays that combine an array XPath with an element
XPath are parsed with the normal runtime converter path instead. This keeps
behavior compatible, but does not get the dispatch fast path.

Call `compile()` once on the root schema and reuse the returned schema.
Non-object root schemas need an XPath.

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [converter/base.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L249)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`string`\>

XML string

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [converter/base.ts:272](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L272)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`Promise`\<`void`\>

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [converter/base.ts:286](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L286)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

[`XmlWriteOptions`](#xmlwriteoptions)

Write options

###### Returns

`string`

XML string

##### writer()

> **writer**(`config`): `this`

Defined in: [converter/base.ts:295](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L295)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

***

### XmlParseError

Defined in: [converter/errors.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/errors.ts#L6)

XML parse error with detailed issue information

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new XmlParseError**(`issues`): [`XmlParseError`](#xmlparseerror)

Defined in: [converter/errors.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/errors.ts#L16)

###### Parameters

###### issues

`object`[]

###### Returns

[`XmlParseError`](#xmlparseerror)

###### Overrides

`Error.constructor`

#### Properties

##### issues

> **issues**: `object`[]

Defined in: [converter/errors.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/errors.ts#L10)

List of validation issues

###### path

> **path**: `string`[]

###### message

> **message**: `string`

###### code

> **code**: `string`

## Interfaces

### WriterOptions

Defined in: [Writer.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L20)

Configuration options for the Writer

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [Writer.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L25)

Text encoding for the output stream

###### Default Value

```ts
'utf-8'
```

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [Writer.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L31)

Whether to format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [Writer.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L37)

String used for indentation when prettyPrint is true

###### Default Value

```ts
'  '
```

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [Writer.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L43)

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

Defined in: [Writer.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L49)

Whether to automatically encode XML entities

###### Default Value

```ts
true
```

##### namespaces?

> `optional` **namespaces?**: [`NamespaceDeclaration`](#namespacedeclaration)[]

Defined in: [Writer.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L55)

Namespace declarations to include

###### Default Value

```ts
[]
```

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [Writer.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L61)

Internal buffer size in bytes

###### Default Value

```ts
16384
```

##### highWaterMark?

> `optional` **highWaterMark?**: `number`

Defined in: [Writer.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L67)

WritableStream backpressure threshold

###### Default Value

```ts
65536
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [Writer.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L73)

Automatic flush threshold (percentage of bufferSize)

###### Default Value

```ts
0.8
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [Writer.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/Writer.ts#L79)

Whether to enable automatic flushing

###### Default Value

```ts
true
```

***

### SyncTextSink

Defined in: [WriterSync.ts:7](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L7)

Sink interface for custom sync targets.

#### Methods

##### write()

> **write**(`chunk`): `void`

Defined in: [WriterSync.ts:8](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L8)

###### Parameters

###### chunk

`string`

###### Returns

`void`

##### flush()?

> `optional` **flush**(): `void`

Defined in: [WriterSync.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L9)

###### Returns

`void`

##### close()?

> `optional` **close**(): `void`

Defined in: [WriterSync.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L10)

###### Returns

`void`

***

### WriterSyncOptions

Defined in: [WriterSync.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L16)

Writer output options shared by string and sink variants.

#### Extended by

- [`WriterSyncSinkOptions`](#writersyncsinkoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [WriterSync.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L17)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [WriterSync.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L18)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [WriterSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L19)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [WriterSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L20)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [WriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L21)

##### namespaces?

> `optional` **namespaces?**: [`NamespaceDeclaration`](#namespacedeclaration)[]

Defined in: [WriterSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L22)

***

### WriterSyncSinkOptions

Defined in: [WriterSync.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L28)

Writer options for sink-based sync mode.

#### Extends

- [`WriterSyncOptions`](#writersyncoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [WriterSync.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L17)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`encoding`](#encoding-1)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [WriterSync.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L18)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`prettyPrint`](#prettyprint-1)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [WriterSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L19)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`indentString`](#indentstring-1)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [WriterSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L20)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`addEntities`](#addentities-1)

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [WriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L21)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`autoEncodeEntities`](#autoencodeentities-1)

##### namespaces?

> `optional` **namespaces?**: [`NamespaceDeclaration`](#namespacedeclaration)[]

Defined in: [WriterSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L22)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`namespaces`](#namespaces-1)

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [WriterSync.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L33)

Internal character buffer size.

###### Default Value

```ts
16384
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [WriterSync.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L39)

Emit buffered chunks automatically when threshold is reached.

###### Default Value

```ts
true
```

##### flushOnClose?

> `optional` **flushOnClose?**: `boolean`

Defined in: [WriterSync.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L45)

Whether to call sink.flush() when the writer is finalized.

###### Default Value

```ts
false
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [WriterSync.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/WriterSync.ts#L52)

Flush threshold (percentage or absolute char count).
If <= 1, treated as percentage of bufferSize. Otherwise absolute char count.

###### Default Value

```ts
0.8
```

***

### ParseOptions

Defined in: [converter/types.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L10)

Parse options for XML converter

#### Properties

##### trimText?

> `optional` **trimText?**: `boolean`

Defined in: [converter/types.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L15)

Whether to trim whitespace from text content

###### Default Value

```ts
false
```

##### decodeEntities?

> `optional` **decodeEntities?**: `boolean`

Defined in: [converter/types.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L21)

Whether to decode XML entities

###### Default Value

```ts
true
```

##### strict?

> `optional` **strict?**: `boolean`

Defined in: [converter/types.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L27)

Strict mode for parsing

###### Default Value

```ts
false
```

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-1)

Defined in: [converter/types.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L34)

XML document conformance mode.

###### Default Value

```ts
'fragment'
```

##### maxDepth?

> `optional` **maxDepth?**: `number`

Defined in: [converter/types.ts:40](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L40)

Maximum XML depth

###### Default Value

```ts
1000
```

##### maxEvents?

> `optional` **maxEvents?**: `number`

Defined in: [converter/types.ts:46](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L46)

Maximum number of events to process

###### Default Value

```ts
1000000
```

##### xpathNamespaces?

> `optional` **xpathNamespaces?**: `Record`\<`string`, `string`\>

Defined in: [converter/types.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L56)

Namespace bindings used by XPath 1.0 prefix resolution.

###### Remarks

XML default namespaces do not automatically apply to unprefixed XPath
element names, matching XPath 1.0 semantics. Bind a prefix here and use it
in XPath expressions when selecting namespaced elements.

***

### XmlStringOptions

Defined in: [converter/types.ts:65](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L65)

Options for string schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: [converter/types.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L69)

XPath expression to locate the element

##### min?

> `optional` **min?**: `number`

Defined in: [converter/types.ts:74](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L74)

Minimum string length

##### max?

> `optional` **max?**: `number`

Defined in: [converter/types.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L79)

Maximum string length

##### pattern?

> `optional` **pattern?**: `RegExp`

Defined in: [converter/types.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L84)

Regular expression pattern to validate against

***

### XmlNumberOptions

Defined in: [converter/types.ts:92](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L92)

Options for number schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: [converter/types.ts:96](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L96)

XPath expression to locate the element

##### min?

> `optional` **min?**: `number`

Defined in: [converter/types.ts:101](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L101)

Minimum value

##### max?

> `optional` **max?**: `number`

Defined in: [converter/types.ts:106](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L106)

Maximum value

##### int?

> `optional` **int?**: `boolean`

Defined in: [converter/types.ts:112](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L112)

Whether the number must be an integer

###### Default Value

```ts
false
```

***

### XmlObjectOptions

Defined in: [converter/types.ts:120](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L120)

Options for object schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: [converter/types.ts:124](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L124)

XPath expression to locate the element

##### strict?

> `optional` **strict?**: `boolean`

Defined in: [converter/types.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L130)

Strict mode - reject unknown properties

###### Default Value

```ts
false
```

***

### XmlElementWriteConfig

Defined in: [converter/types.ts:138](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L138)

Writer configuration for XML element

#### Properties

##### element

> **element**: `string`

Defined in: [converter/types.ts:142](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L142)

Element name (required)

##### asAttribute?

> `optional` **asAttribute?**: `string`

Defined in: [converter/types.ts:148](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L148)

Write as attribute instead of element
Value is the attribute name

##### namespace?

> `optional` **namespace?**: `object`

Defined in: [converter/types.ts:153](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L153)

Namespace configuration

###### prefix?

> `optional` **prefix?**: `string`

Namespace prefix (e.g., 'dc', 'xsi')

###### uri?

> `optional` **uri?**: `string`

Namespace URI (e.g., 'http://purl.org/dc/elements/1.1/')

##### cdata?

> `optional` **cdata?**: `boolean`

Defined in: [converter/types.ts:169](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L169)

Wrap content in CDATA section

###### Default Value

```ts
false
```

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: [converter/types.ts:175](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L175)

Use self-closing tag for empty elements

###### Default Value

```ts
false
```

##### comment?

> `optional` **comment?**: `string`

Defined in: [converter/types.ts:180](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L180)

Add XML comment before element

***

### XmlWriteOptions

Defined in: [converter/types.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L188)

Options for XML writer

#### Properties

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [converter/types.ts:193](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L193)

Format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [converter/types.ts:199](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L199)

Indentation string

###### Default Value

```ts
'  '
```

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [converter/types.ts:205](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L205)

Text encoding for output

###### Default Value

```ts
'utf-8'
```

##### rootElement?

> `optional` **rootElement?**: `string`

Defined in: [converter/types.ts:211](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L211)

Root element name
If not provided, no root element wrapper is added

##### namespaces?

> `optional` **namespaces?**: `object`[]

Defined in: [converter/types.ts:216](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L216)

Global namespace declarations

###### prefix

> **prefix**: `string`

###### uri

> **uri**: `string`

##### includeDeclaration?

> `optional` **includeDeclaration?**: `boolean`

Defined in: [converter/types.ts:225](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L225)

Include XML declaration

###### Default Value

```ts
true
```

##### xmlVersion?

> `optional` **xmlVersion?**: `string`

Defined in: [converter/types.ts:231](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L231)

XML version for declaration

###### Default Value

```ts
'1.0'
```

##### writer?

> `optional` **writer?**: [`Writer`](#writer) \| [`WriterSync`](#writersync) \| [`WriterSyncSink`](#writersyncsink)

Defined in: [converter/types.ts:239](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L239)

Custom writer instance
- WriterSync: for writeSync() method
- WriterSyncSink: for writeSync() with custom sink
- Writer: for write() async method

***

### StartDocumentEvent

Defined in: [types.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L48)

Event fired when the document starts parsing

#### Properties

##### type

> **type**: `"START_DOCUMENT"`

Defined in: [types.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L49)

***

### EndDocumentEvent

Defined in: [types.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L57)

Event fired when the document ends parsing

#### Properties

##### type

> **type**: `"END_DOCUMENT"`

Defined in: [types.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L58)

***

### StartElementEvent

Defined in: [types.ts:66](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L66)

Event fired when an XML element starts

#### Properties

##### type

> **type**: `"START_ELEMENT"`

Defined in: [types.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L67)

##### name

> **name**: `string`

Defined in: [types.ts:68](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L68)

##### localName?

> `optional` **localName?**: `string`

Defined in: [types.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L69)

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [types.ts:70](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L70)

##### uri?

> `optional` **uri?**: `string`

Defined in: [types.ts:71](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L71)

##### attributes

> **attributes**: `Record`\<`string`, `string`\>

Defined in: [types.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L72)

##### attributesWithPrefix?

> `optional` **attributesWithPrefix?**: `Record`\<`string`, [`AttributeInfo`](#attributeinfo)\>

Defined in: [types.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L73)

***

### EndElementEvent

Defined in: [types.ts:76](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L76)

#### Properties

##### type

> **type**: `"END_ELEMENT"`

Defined in: [types.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L77)

##### name

> **name**: `string`

Defined in: [types.ts:78](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L78)

##### localName?

> `optional` **localName?**: `string`

Defined in: [types.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L79)

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [types.ts:80](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L80)

##### uri?

> `optional` **uri?**: `string`

Defined in: [types.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L81)

***

### CharactersEvent

Defined in: [types.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L84)

#### Properties

##### type

> **type**: `"CHARACTERS"`

Defined in: [types.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L85)

##### value

> **value**: `string`

Defined in: [types.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L86)

***

### CdataEvent

Defined in: [types.ts:89](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L89)

#### Properties

##### type

> **type**: `"CDATA"`

Defined in: [types.ts:90](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L90)

##### value

> **value**: `string`

Defined in: [types.ts:91](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L91)

***

### ErrorEvent

Defined in: [types.ts:94](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L94)

#### Properties

##### type

> **type**: `"ERROR"`

Defined in: [types.ts:95](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L95)

##### error

> **error**: `Error`

Defined in: [types.ts:96](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L96)

***

### XmlAttribute

Defined in: [types.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L114)

Attribute interface (for Writer)

#### Properties

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [types.ts:115](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L115)

##### localName

> **localName**: `string`

Defined in: [types.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L116)

##### uri?

> `optional` **uri?**: `string`

Defined in: [types.ts:117](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L117)

##### value

> **value**: `string`

Defined in: [types.ts:118](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L118)

***

### NamespaceDeclaration

Defined in: [types.ts:125](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L125)

Namespace declaration interface (for Writer)
Not used in this simple implementation.

#### Properties

##### prefix

> **prefix**: `string`

Defined in: [types.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L126)

##### uri

> **uri**: `string`

Defined in: [types.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L127)

***

### ProcessingInstruction

Defined in: [types.ts:134](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L134)

Processing instruction (PI) interface (for Writer)
Not used in this simple implementation.

#### Properties

##### target

> **target**: `string`

Defined in: [types.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L135)

##### data?

> `optional` **data?**: `string`

Defined in: [types.ts:136](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L136)

***

### AttributeInfo

Defined in: [types.ts:142](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L142)

Attribute information interface

#### Properties

##### value

> **value**: `string`

Defined in: [types.ts:143](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L143)

##### localName

> **localName**: `string`

Defined in: [types.ts:144](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L144)

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [types.ts:145](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L145)

##### uri?

> `optional` **uri?**: `string`

Defined in: [types.ts:146](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L146)

***

### WriteElementOptions

Defined in: [types.ts:354](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L354)

Element writing options interface (for Writer)

#### Properties

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [types.ts:355](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L355)

##### uri?

> `optional` **uri?**: `string`

Defined in: [types.ts:356](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L356)

##### attributes?

> `optional` **attributes?**: `Record`\<`string`, `string` \| [`AttributeInfo`](#attributeinfo)\>

Defined in: [types.ts:357](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L357)

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: [types.ts:358](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L358)

##### comment?

> `optional` **comment?**: `string`

Defined in: [types.ts:359](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L359)

## Type Aliases

### XmlObjectShape

> **XmlObjectShape** = `Record`\<`string`, [`XmlSchema`](#abstract-xmlschema)\<`unknown`, `unknown`\>\>

Defined in: [converter/XmlObjectSchema.ts:42](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L42)

Shape type for object schema

***

### InferObjectOutput

> **InferObjectOutput**\<`T`\> = `{ [K in keyof T]: T[K]["_output"] }`

Defined in: [converter/XmlObjectSchema.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L49)

Infer output type from object shape

#### Type Parameters

##### T

`T` *extends* [`XmlObjectShape`](#xmlobjectshape)

***

### ParseInput

> **ParseInput** = `string` \| `ArrayBufferView` \| `ReadableStream`\<`Uint8Array`\> \| `AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\> \| `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [converter/base.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L14)

Parse input type - accepts string, sync iterator, async iterator, or ReadableStream

***

### ParseResult

> **ParseResult**\<`T`\> = \{ `success`: `true`; `data`: `T`; \} \| \{ `success`: `false`; `error`: [`XmlParseError`](#xmlparseerror); \}

Defined in: [converter/errors.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/errors.ts#L28)

Parse result type for safe parsing operations

#### Type Parameters

##### T

`T`

***

### Infer

> **Infer**\<`T`\> = `T`\[`"_output"`\]

Defined in: [converter/index.ts:108](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/index.ts#L108)

#### Type Parameters

##### T

`T` *extends* [`XmlSchema`](#abstract-xmlschema)\<`unknown`, `unknown`\>

***

### SchemaType

> **SchemaType** = *typeof* [`SchemaType`](#schematype)\[keyof *typeof* [`SchemaType`](#schematype)\]

Defined in: [converter/types.ts:247](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L247)

Schema type union

***

### XmlCoreSchema

> **XmlCoreSchema** = [`XmlStringSchema`](#xmlstringschema) \| [`XmlNumberSchema`](#xmlnumberschema) \| [`XmlArraySchema`](#xmlarrayschema)\<[`XmlSchemaBase`](#abstract-xmlschemabase)\<`unknown`, `unknown`\>\> \| [`XmlObjectSchema`](#xmlobjectschema)\<[`XmlObjectShape`](#xmlobjectshape)\>

Defined in: [converter/types.ts:277](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L277)

Core schema types (non-wrapper schemas)

***

### XmlWrappedSchema

> **XmlWrappedSchema** = [`XmlTransformSchema`](#xmltransformschema)\<`unknown`, `unknown`\> \| [`XmlOptionalSchema`](#xmloptionalschema)\<[`XmlSchemaBase`](#abstract-xmlschemabase)\<`unknown`, `unknown`\>\>

Defined in: [converter/types.ts:288](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L288)

Wrapper schema types (transform and optional)

***

### AnyXmlSchema

> **AnyXmlSchema** = [`XmlCoreSchema`](#xmlcoreschema) \| [`XmlWrappedSchema`](#xmlwrappedschema)

Defined in: [converter/types.ts:297](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L297)

Any XML schema type

***

### XmlEventType

> **XmlEventType** = *typeof* [`XmlEventType`](#xmleventtype)\[keyof *typeof* [`XmlEventType`](#xmleventtype)\]

Defined in: [types.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L6)

Enumeration of XML stream event types used by the StAX parser

***

### AnyXmlEvent

> **AnyXmlEvent** = [`StartDocumentEvent`](#startdocumentevent) \| [`EndDocumentEvent`](#enddocumentevent) \| [`StartElementEvent`](#startelementevent) \| [`EndElementEvent`](#endelementevent) \| [`CharactersEvent`](#charactersevent) \| [`CdataEvent`](#cdataevent) \| [`ErrorEvent`](#errorevent)

Defined in: [types.ts:102](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L102)

Discriminated Union type for developer use

***

### DocumentMode

> **DocumentMode** = `"fragment"` \| `"document"`

Defined in: [types.ts:373](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L373)

XML document conformance mode.

## Variables

### x

> `const` **x**: [`XmlBuilder`](#xmlbuilder)

Defined in: [converter/XmlBuilder.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L58)

Singleton builder instance

***

### SchemaType

> `const` **SchemaType**: `object`

Defined in: [converter/types.ts:247](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L247)

Schema type constants for XML schema classification

#### Type Declaration

##### STRING

> `readonly` **STRING**: `"STRING"` = `'STRING'`

##### NUMBER

> `readonly` **NUMBER**: `"NUMBER"` = `'NUMBER'`

##### ARRAY

> `readonly` **ARRAY**: `"ARRAY"` = `'ARRAY'`

##### OBJECT

> `readonly` **OBJECT**: `"OBJECT"` = `'OBJECT'`

##### TRANSFORM

> `readonly` **TRANSFORM**: `"TRANSFORM"` = `'TRANSFORM'`

##### OPTIONAL

> `readonly` **OPTIONAL**: `"OPTIONAL"` = `'OPTIONAL'`

***

### XmlEventType

> `const` **XmlEventType**: `object`

Defined in: [types.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L6)

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

### isStringSchema()

> **isStringSchema**(`schema`): `schema is XmlStringSchema`

Defined in: [converter/types.ts:304](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L304)

Type guard for string schema

#### Parameters

##### schema

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`unknown`, `unknown`\>

#### Returns

`schema is XmlStringSchema`

***

### isNumberSchema()

> **isNumberSchema**(`schema`): `schema is XmlNumberSchema`

Defined in: [converter/types.ts:313](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L313)

Type guard for number schema

#### Parameters

##### schema

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`unknown`, `unknown`\>

#### Returns

`schema is XmlNumberSchema`

***

### isArraySchema()

> **isArraySchema**(`schema`): `schema is XmlArraySchema<XmlSchemaBase<unknown, unknown>>`

Defined in: [converter/types.ts:322](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L322)

Type guard for array schema

#### Parameters

##### schema

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`unknown`, `unknown`\>

#### Returns

`schema is XmlArraySchema<XmlSchemaBase<unknown, unknown>>`

***

### isObjectSchema()

> **isObjectSchema**(`schema`): `schema is XmlObjectSchema<XmlObjectShape>`

Defined in: [converter/types.ts:331](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L331)

Type guard for object schema

#### Parameters

##### schema

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`unknown`, `unknown`\>

#### Returns

`schema is XmlObjectSchema<XmlObjectShape>`

***

### isTransformSchema()

> **isTransformSchema**(`schema`): `schema is XmlTransformSchema<unknown, unknown, unknown>`

Defined in: [converter/types.ts:340](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L340)

Type guard for transform schema

#### Parameters

##### schema

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`unknown`, `unknown`\>

#### Returns

`schema is XmlTransformSchema<unknown, unknown, unknown>`

***

### isOptionalSchema()

> **isOptionalSchema**(`schema`): `schema is XmlOptionalSchema<XmlSchemaBase<unknown, unknown>>`

Defined in: [converter/types.ts:349](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L349)

Type guard for optional schema

#### Parameters

##### schema

[`XmlSchemaBase`](#abstract-xmlschemabase)\<`unknown`, `unknown`\>

#### Returns

`schema is XmlOptionalSchema<XmlSchemaBase<unknown, unknown>>`
