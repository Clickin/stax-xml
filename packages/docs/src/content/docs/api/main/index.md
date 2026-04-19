---
title: stax-xml
description: API reference for stax-xml
---

**stax-xml**

***

# stax-xml

## Classes

### StaxXmlParser

Defined in: [StaxXmlParser.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L55)

#### Implements

- `AsyncIterable`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new StaxXmlParser**(`xmlStream`, `options?`): [`StaxXmlParser`](#staxxmlparser)

Defined in: [StaxXmlParser.ts:108](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L108)

###### Parameters

###### xmlStream

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

[`StaxXmlParserOptions`](#staxxmlparseroptions) = `{}`

###### Returns

[`StaxXmlParser`](#staxxmlparser)

#### Accessors

##### XmlEventType

###### Get Signature

> **get** **XmlEventType**(): `object`

Defined in: [StaxXmlParser.ts:206](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L206)

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

Defined in: [StaxXmlParser.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L135)

###### Returns

`AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`AsyncIterable.[asyncIterator]`

##### next()

> **next**(): `IteratorResultLike`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [StaxXmlParser.ts:139](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L139)

###### Returns

`IteratorResultLike`\<[`AnyXmlEvent`](#anyxmlevent)\>

##### return()

> **return**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: [StaxXmlParser.ts:157](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L157)

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

##### nextBatch()

> **nextBatch**(): `Promise`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

Defined in: [StaxXmlParser.ts:170](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L170)

###### Returns

`Promise`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

##### batchedIterator()

> **batchedIterator**(): `AsyncGenerator`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

Defined in: [StaxXmlParser.ts:195](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L195)

###### Returns

`AsyncGenerator`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

***

### StaxXmlParserSync

Defined in: [StaxXmlParserSync.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L45)

TRUE INCREMENTAL State Machine XML Parser

Eliminates Generator overhead while maintaining StAX pull-based API
Parses exactly ONE event per next() call (true incremental)

Performance: +20.67% improvement vs Generator baseline

#### Implements

- `Iterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new StaxXmlParserSync**(`xml`, `options?`): [`StaxXmlParserSync`](#staxxmlparsersync)

Defined in: [StaxXmlParserSync.ts:105](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L105)

###### Parameters

###### xml

`string`

###### options?

[`StaxXmlParserSyncOptions`](#staxxmlparsersyncoptions) = `{}`

###### Returns

[`StaxXmlParserSync`](#staxxmlparsersync)

#### Methods

##### \[iterator\]()

> **\[iterator\]**(): `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [StaxXmlParserSync.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L126)

Symbol.iterator implementation - enables for...of loops
Returns self to maintain single iterator state

###### Returns

`Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterable.[iterator]`

##### next()

> **next**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [StaxXmlParserSync.ts:138](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L138)

Main Iterator.next() implementation - TRUE INCREMENTAL parsing

Parses exactly ONE event per call without Generator overhead
Uses state machine to track parsing progress

Performance: ~10ns/event overhead (vs ~95ns for Generator)

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.next`

***

### StaxXmlWriter

Defined in: [StaxXmlWriter.ts:131](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L131)

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

> **new StaxXmlWriter**(`stream`, `options?`): [`StaxXmlWriter`](#staxxmlwriter)

Defined in: [StaxXmlWriter.ts:170](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L170)

###### Parameters

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

[`StaxXmlWriterOptions`](#staxxmlwriteroptions) = `{}`

###### Returns

[`StaxXmlWriter`](#staxxmlwriter)

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:286](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L286)

Write XML declaration

###### Parameters

###### version?

`string` = `'1.0'`

###### encoding?

`string`

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeEndDocument()

> **writeEndDocument**(): `Promise`\<`void`\>

Defined in: [StaxXmlWriter.ts:312](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L312)

End document (automatically close all elements)

###### Returns

`Promise`\<`void`\>

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:333](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L333)

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

Defined in: [StaxXmlWriter.ts:425](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L425)

Write end element

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeCharacters()

> **writeCharacters**(`text`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:458](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L458)

Write text

###### Parameters

###### text

`string`

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeCData()

> **writeCData**(`cdata`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:480](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L480)

Write CDATA section

###### Parameters

###### cdata

`string`

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeComment()

> **writeComment**(`comment`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:500](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L500)

Write comment

###### Parameters

###### comment

`string`

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeRaw()

> **writeRaw**(`xml`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:523](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L523)

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

Defined in: [StaxXmlWriter.ts:532](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L532)

Manual flush

###### Returns

`Promise`\<`void`\>

##### getMetrics()

> **getMetrics**(): `object`

Defined in: [StaxXmlWriter.ts:539](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L539)

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

Defined in: [StaxXmlWriterSync.ts:496](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L496)

String-based sync writer.

#### Extends

- `AbstractStaxXmlWriterSync`

#### Constructors

##### Constructor

> **new StaxXmlWriterSync**(`options?`): [`StaxXmlWriterSync`](#staxxmlwritersync)

Defined in: [StaxXmlWriterSync.ts:499](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L499)

###### Parameters

###### options?

[`StaxXmlWriterSyncOptions`](#staxxmlwritersyncoptions) = `{}`

###### Returns

[`StaxXmlWriterSync`](#staxxmlwritersync)

###### Overrides

`AbstractStaxXmlWriterSync.constructor`

#### Properties

##### state

> `protected` **state**: `WriterState` = `WriterState.INITIAL`

Defined in: [StaxXmlWriterSync.ts:80](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L80)

###### Inherited from

`AbstractStaxXmlWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[] = `[]`

Defined in: [StaxXmlWriterSync.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L81)

###### Inherited from

`AbstractStaxXmlWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[] = `[]`

Defined in: [StaxXmlWriterSync.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L82)

###### Inherited from

`AbstractStaxXmlWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[] = `[]`

Defined in: [StaxXmlWriterSync.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L83)

###### Inherited from

`AbstractStaxXmlWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[] = `[]`

Defined in: [StaxXmlWriterSync.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L84)

###### Inherited from

`AbstractStaxXmlWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`StaxXmlWriterSyncOptions`](#staxxmlwritersyncoptions)\>

Defined in: [StaxXmlWriterSync.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L85)

###### Inherited from

`AbstractStaxXmlWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number` = `0`

Defined in: [StaxXmlWriterSync.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L86)

###### Inherited from

`AbstractStaxXmlWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean` = `false`

Defined in: [StaxXmlWriterSync.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L87)

###### Inherited from

`AbstractStaxXmlWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: [StaxXmlWriterSync.ts:88](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L88)

###### Inherited from

`AbstractStaxXmlWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: [StaxXmlWriterSync.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L135)

Writes the XML declaration (e.g., <?xml version="1.0" encoding="UTF-8"?>).

###### Parameters

###### version?

`string` = `'1.0'`

###### encoding?

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeStartDocument`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: [StaxXmlWriterSync.ts:160](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L160)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Inherited from

`AbstractStaxXmlWriterSync.writeEndDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: [StaxXmlWriterSync.ts:172](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L172)

###### Parameters

###### localName

`string`

###### options?

[`WriteElementOptions`](#writeelementoptions)

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeStartElement`

##### writeAttribute()

> **writeAttribute**(`localName`, `value`, `prefix?`): `this`

Defined in: [StaxXmlWriterSync.ts:251](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L251)

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

`AbstractStaxXmlWriterSync.writeAttribute`

##### writeNamespace()

> **writeNamespace**(`prefix`, `uri`): `this`

Defined in: [StaxXmlWriterSync.ts:261](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L261)

###### Parameters

###### prefix

`string`

###### uri

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeNamespace`

##### writeCharacters()

> **writeCharacters**(`text`): `this`

Defined in: [StaxXmlWriterSync.ts:278](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L278)

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [StaxXmlWriterSync.ts:292](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L292)

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [StaxXmlWriterSync.ts:309](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L309)

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [StaxXmlWriterSync.ts:324](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L324)

###### Parameters

###### target

`string`

###### data?

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeProcessingInstruction`

##### writeRaw()

> **writeRaw**(`xml`): `this`

Defined in: [StaxXmlWriterSync.ts:346](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L346)

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [StaxXmlWriterSync.ts:352](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L352)

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [StaxXmlWriterSync.ts:384](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L384)

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [StaxXmlWriterSync.ts:389](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L389)

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [StaxXmlWriterSync.ts:395](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L395)

###### Returns

`boolean`

###### Inherited from

`AbstractStaxXmlWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [StaxXmlWriterSync.ts:399](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L399)

###### Returns

`string`

###### Inherited from

`AbstractStaxXmlWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: [StaxXmlWriterSync.ts:421](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L421)

###### Returns

`void`

###### Inherited from

`AbstractStaxXmlWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: [StaxXmlWriterSync.ts:439](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L439)

###### Returns

`void`

###### Inherited from

`AbstractStaxXmlWriterSync._writeNewline`

##### getXmlString()

> **getXmlString**(): `string`

Defined in: [StaxXmlWriterSync.ts:503](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L503)

###### Returns

`string`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: [StaxXmlWriterSync.ts:507](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L507)

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractStaxXmlWriterSync._emit`

***

### StaxXmlWriterSyncSink

Defined in: [StaxXmlWriterSync.ts:515](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L515)

Sink-based sync writer. Use this for file/buffer incremental writes.

#### Extends

- `AbstractStaxXmlWriterSync`

#### Constructors

##### Constructor

> **new StaxXmlWriterSyncSink**(`sink`, `options?`): [`StaxXmlWriterSyncSink`](#staxxmlwritersyncsink)

Defined in: [StaxXmlWriterSync.ts:523](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L523)

###### Parameters

###### sink

[`SyncTextSink`](#synctextsink)

###### options?

[`StaxXmlWriterSyncSinkOptions`](#staxxmlwritersyncsinkoptions) = `{}`

###### Returns

[`StaxXmlWriterSyncSink`](#staxxmlwritersyncsink)

###### Overrides

`AbstractStaxXmlWriterSync.constructor`

#### Properties

##### state

> `protected` **state**: `WriterState` = `WriterState.INITIAL`

Defined in: [StaxXmlWriterSync.ts:80](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L80)

###### Inherited from

`AbstractStaxXmlWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[] = `[]`

Defined in: [StaxXmlWriterSync.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L81)

###### Inherited from

`AbstractStaxXmlWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[] = `[]`

Defined in: [StaxXmlWriterSync.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L82)

###### Inherited from

`AbstractStaxXmlWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[] = `[]`

Defined in: [StaxXmlWriterSync.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L83)

###### Inherited from

`AbstractStaxXmlWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[] = `[]`

Defined in: [StaxXmlWriterSync.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L84)

###### Inherited from

`AbstractStaxXmlWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`StaxXmlWriterSyncOptions`](#staxxmlwritersyncoptions)\>

Defined in: [StaxXmlWriterSync.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L85)

###### Inherited from

`AbstractStaxXmlWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number` = `0`

Defined in: [StaxXmlWriterSync.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L86)

###### Inherited from

`AbstractStaxXmlWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean` = `false`

Defined in: [StaxXmlWriterSync.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L87)

###### Inherited from

`AbstractStaxXmlWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: [StaxXmlWriterSync.ts:88](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L88)

###### Inherited from

`AbstractStaxXmlWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: [StaxXmlWriterSync.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L135)

Writes the XML declaration (e.g., <?xml version="1.0" encoding="UTF-8"?>).

###### Parameters

###### version?

`string` = `'1.0'`

###### encoding?

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeStartDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: [StaxXmlWriterSync.ts:172](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L172)

###### Parameters

###### localName

`string`

###### options?

[`WriteElementOptions`](#writeelementoptions)

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeStartElement`

##### writeAttribute()

> **writeAttribute**(`localName`, `value`, `prefix?`): `this`

Defined in: [StaxXmlWriterSync.ts:251](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L251)

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

`AbstractStaxXmlWriterSync.writeAttribute`

##### writeNamespace()

> **writeNamespace**(`prefix`, `uri`): `this`

Defined in: [StaxXmlWriterSync.ts:261](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L261)

###### Parameters

###### prefix

`string`

###### uri

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeNamespace`

##### writeCharacters()

> **writeCharacters**(`text`): `this`

Defined in: [StaxXmlWriterSync.ts:278](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L278)

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [StaxXmlWriterSync.ts:292](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L292)

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [StaxXmlWriterSync.ts:309](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L309)

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [StaxXmlWriterSync.ts:324](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L324)

###### Parameters

###### target

`string`

###### data?

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeProcessingInstruction`

##### writeRaw()

> **writeRaw**(`xml`): `this`

Defined in: [StaxXmlWriterSync.ts:346](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L346)

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [StaxXmlWriterSync.ts:352](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L352)

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [StaxXmlWriterSync.ts:384](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L384)

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [StaxXmlWriterSync.ts:389](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L389)

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractStaxXmlWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [StaxXmlWriterSync.ts:395](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L395)

###### Returns

`boolean`

###### Inherited from

`AbstractStaxXmlWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [StaxXmlWriterSync.ts:399](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L399)

###### Returns

`string`

###### Inherited from

`AbstractStaxXmlWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: [StaxXmlWriterSync.ts:421](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L421)

###### Returns

`void`

###### Inherited from

`AbstractStaxXmlWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: [StaxXmlWriterSync.ts:439](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L439)

###### Returns

`void`

###### Inherited from

`AbstractStaxXmlWriterSync._writeNewline`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: [StaxXmlWriterSync.ts:539](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L539)

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractStaxXmlWriterSync._emit`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: [StaxXmlWriterSync.ts:580](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L580)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Overrides

`AbstractStaxXmlWriterSync.writeEndDocument`

##### flush()

> **flush**(): `void`

Defined in: [StaxXmlWriterSync.ts:588](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L588)

###### Returns

`void`

##### close()

> **close**(): `void`

Defined in: [StaxXmlWriterSync.ts:595](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L595)

###### Returns

`void`

***

### XmlCursorReader

Defined in: [cursor/XmlCursorReader.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L52)

#### Constructors

##### Constructor

> **new XmlCursorReader**(`xml`, `options?`): [`XmlCursorReader`](#xmlcursorreader)

Defined in: [cursor/XmlCursorReader.ts:103](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L103)

###### Parameters

###### xml

`string`

###### options?

[`XmlCursorReaderOptions`](#xmlcursorreaderoptions) = `{}`

###### Returns

[`XmlCursorReader`](#xmlcursorreader)

#### Methods

##### next()

> **next**(): `boolean`

Defined in: [cursor/XmlCursorReader.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L114)

###### Returns

`boolean`

##### eventType()

> **eventType**(): [`CursorEventType`](#cursoreventtype-1)

Defined in: [cursor/XmlCursorReader.ts:153](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L153)

###### Returns

[`CursorEventType`](#cursoreventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: [cursor/XmlCursorReader.ts:157](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L157)

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: [cursor/XmlCursorReader.ts:162](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L162)

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string` \| `undefined`

Defined in: [cursor/XmlCursorReader.ts:169](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L169)

###### Returns

`string` \| `undefined`

##### uri()

> **uri**(): `string` \| `undefined`

Defined in: [cursor/XmlCursorReader.ts:174](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L174)

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [cursor/XmlCursorReader.ts:183](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L183)

###### Returns

`string` \| `undefined`

##### getAttributeCount()

> **getAttributeCount**(): `number`

Defined in: [cursor/XmlCursorReader.ts:189](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L189)

###### Returns

`number`

##### getAttributeName()

> **getAttributeName**(`i`): `string` \| `undefined`

Defined in: [cursor/XmlCursorReader.ts:195](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L195)

###### Parameters

###### i

`number`

###### Returns

`string` \| `undefined`

##### getAttributeLocalName()

> **getAttributeLocalName**(`i`): `string` \| `undefined`

Defined in: [cursor/XmlCursorReader.ts:203](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L203)

###### Parameters

###### i

`number`

###### Returns

`string` \| `undefined`

##### getAttributePrefix()

> **getAttributePrefix**(`i`): `string` \| `undefined`

Defined in: [cursor/XmlCursorReader.ts:215](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L215)

###### Parameters

###### i

`number`

###### Returns

`string` \| `undefined`

##### getAttributeValue()

> **getAttributeValue**(`indexOrName`): `string` \| `undefined`

Defined in: [cursor/XmlCursorReader.ts:225](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L225)

###### Parameters

###### indexOrName

`string` \| `number`

###### Returns

`string` \| `undefined`

##### getAttributeUri()

> **getAttributeUri**(`i`): `string` \| `undefined`

Defined in: [cursor/XmlCursorReader.ts:245](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L245)

###### Parameters

###### i

`number`

###### Returns

`string` \| `undefined`

##### depth()

> **depth**(): `number`

Defined in: [cursor/XmlCursorReader.ts:258](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReader.ts#L258)

###### Returns

`number`

***

### XmlCursorReaderAsync

Defined in: [cursor/XmlCursorReaderAsync.ts:46](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L46)

#### Constructors

##### Constructor

> **new XmlCursorReaderAsync**(`stream`, `options?`): [`XmlCursorReaderAsync`](#xmlcursorreaderasync)

Defined in: [cursor/XmlCursorReaderAsync.ts:96](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L96)

###### Parameters

###### stream

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

[`XmlCursorReaderAsyncOptions`](#xmlcursorreaderasyncoptions) = `{}`

###### Returns

[`XmlCursorReaderAsync`](#xmlcursorreaderasync)

#### Methods

##### next()

> **next**(): `Promise`\<`boolean`\>

Defined in: [cursor/XmlCursorReaderAsync.ts:112](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L112)

###### Returns

`Promise`\<`boolean`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [cursor/XmlCursorReaderAsync.ts:149](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L149)

###### Returns

`Promise`\<`void`\>

##### eventType()

> **eventType**(): [`CursorEventType`](#cursoreventtype-1)

Defined in: [cursor/XmlCursorReaderAsync.ts:156](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L156)

###### Returns

[`CursorEventType`](#cursoreventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: [cursor/XmlCursorReaderAsync.ts:158](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L158)

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: [cursor/XmlCursorReaderAsync.ts:164](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L164)

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string` \| `undefined`

Defined in: [cursor/XmlCursorReaderAsync.ts:172](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L172)

###### Returns

`string` \| `undefined`

##### uri()

> **uri**(): `string` \| `undefined`

Defined in: [cursor/XmlCursorReaderAsync.ts:178](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L178)

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [cursor/XmlCursorReaderAsync.ts:186](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L186)

###### Returns

`string` \| `undefined`

##### getAttributeCount()

> **getAttributeCount**(): `number`

Defined in: [cursor/XmlCursorReaderAsync.ts:193](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L193)

###### Returns

`number`

##### getAttributeName()

> **getAttributeName**(`i`): `string` \| `undefined`

Defined in: [cursor/XmlCursorReaderAsync.ts:195](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L195)

###### Parameters

###### i

`number`

###### Returns

`string` \| `undefined`

##### getAttributeLocalName()

> **getAttributeLocalName**(`i`): `string` \| `undefined`

Defined in: [cursor/XmlCursorReaderAsync.ts:202](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L202)

###### Parameters

###### i

`number`

###### Returns

`string` \| `undefined`

##### getAttributePrefix()

> **getAttributePrefix**(`i`): `string` \| `undefined`

Defined in: [cursor/XmlCursorReaderAsync.ts:212](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L212)

###### Parameters

###### i

`number`

###### Returns

`string` \| `undefined`

##### getAttributeValue()

> **getAttributeValue**(`indexOrName`): `string` \| `undefined`

Defined in: [cursor/XmlCursorReaderAsync.ts:220](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L220)

###### Parameters

###### indexOrName

`string` \| `number`

###### Returns

`string` \| `undefined`

##### getAttributeUri()

> **getAttributeUri**(`i`): `string` \| `undefined`

Defined in: [cursor/XmlCursorReaderAsync.ts:241](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L241)

###### Parameters

###### i

`number`

###### Returns

`string` \| `undefined`

##### depth()

> **depth**(): `number`

Defined in: [cursor/XmlCursorReaderAsync.ts:252](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/XmlCursorReaderAsync.ts#L252)

###### Returns

`number`

## Interfaces

### StaxXmlParserOptions

Defined in: [StaxXmlParser.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L14)

Configuration options for the StaxXmlParser

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [StaxXmlParser.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L19)

Text encoding for the input stream

###### Default Value

```ts
'utf-8'
```

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [StaxXmlParser.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L25)

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

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [StaxXmlParser.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L31)

Whether to automatically decode XML entities

###### Default Value

```ts
true
```

##### maxBufferSize?

> `optional` **maxBufferSize?**: `number`

Defined in: [StaxXmlParser.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L37)

Maximum buffer size in bytes

###### Default Value

```ts
65536
```

##### enableBufferCompaction?

> `optional` **enableBufferCompaction?**: `boolean`

Defined in: [StaxXmlParser.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L43)

Whether to enable buffer compaction for memory efficiency

###### Default Value

```ts
true
```

##### initialQueueCapacity?

> `optional` **initialQueueCapacity?**: `number`

Defined in: [StaxXmlParser.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L49)

Initial event queue capacity (circular buffer size)

###### Default Value

```ts
1024
```

##### eventFilter?

> `optional` **eventFilter?**: `ParserEventFilter`

Defined in: [StaxXmlParser.ts:51](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L51)

***

### StaxXmlParserSyncOptions

Defined in: [StaxXmlParserSync.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L18)

#### Properties

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [StaxXmlParserSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L19)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [StaxXmlParserSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L20)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### eventFilter?

> `optional` **eventFilter?**: `ParserEventFilter`

Defined in: [StaxXmlParserSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L21)

***

### StaxXmlWriterOptions

Defined in: [StaxXmlWriter.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L20)

Configuration options for the StaxXmlWriter

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [StaxXmlWriter.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L25)

Text encoding for the output stream

###### Default Value

```ts
'utf-8'
```

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [StaxXmlWriter.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L31)

Whether to format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [StaxXmlWriter.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L37)

String used for indentation when prettyPrint is true

###### Default Value

```ts
'  '
```

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [StaxXmlWriter.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L43)

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

Defined in: [StaxXmlWriter.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L49)

Whether to automatically encode XML entities

###### Default Value

```ts
true
```

##### namespaces?

> `optional` **namespaces?**: `NamespaceDeclaration`[]

Defined in: [StaxXmlWriter.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L55)

Namespace declarations to include

###### Default Value

```ts
[]
```

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [StaxXmlWriter.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L61)

Internal buffer size in bytes

###### Default Value

```ts
16384
```

##### highWaterMark?

> `optional` **highWaterMark?**: `number`

Defined in: [StaxXmlWriter.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L67)

WritableStream backpressure threshold

###### Default Value

```ts
65536
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [StaxXmlWriter.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L73)

Automatic flush threshold (percentage of bufferSize)

###### Default Value

```ts
0.8
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [StaxXmlWriter.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L79)

Whether to enable automatic flushing

###### Default Value

```ts
true
```

***

### SyncTextSink

Defined in: [StaxXmlWriterSync.ts:7](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L7)

Sink interface for custom sync targets.

#### Methods

##### write()

> **write**(`chunk`): `void`

Defined in: [StaxXmlWriterSync.ts:8](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L8)

###### Parameters

###### chunk

`string`

###### Returns

`void`

##### flush()?

> `optional` **flush**(): `void`

Defined in: [StaxXmlWriterSync.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L9)

###### Returns

`void`

##### close()?

> `optional` **close**(): `void`

Defined in: [StaxXmlWriterSync.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L10)

###### Returns

`void`

***

### StaxXmlWriterSyncOptions

Defined in: [StaxXmlWriterSync.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L16)

Writer output options shared by string and sink variants.

#### Extended by

- [`StaxXmlWriterSyncSinkOptions`](#staxxmlwritersyncsinkoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [StaxXmlWriterSync.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L17)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [StaxXmlWriterSync.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L18)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [StaxXmlWriterSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L19)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [StaxXmlWriterSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L20)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [StaxXmlWriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L21)

##### namespaces?

> `optional` **namespaces?**: `NamespaceDeclaration`[]

Defined in: [StaxXmlWriterSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L22)

***

### StaxXmlWriterSyncSinkOptions

Defined in: [StaxXmlWriterSync.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L28)

Writer options for sink-based sync mode.

#### Extends

- [`StaxXmlWriterSyncOptions`](#staxxmlwritersyncoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [StaxXmlWriterSync.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L17)

###### Inherited from

[`StaxXmlWriterSyncOptions`](#staxxmlwritersyncoptions).[`encoding`](#encoding-2)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [StaxXmlWriterSync.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L18)

###### Inherited from

[`StaxXmlWriterSyncOptions`](#staxxmlwritersyncoptions).[`prettyPrint`](#prettyprint-1)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [StaxXmlWriterSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L19)

###### Inherited from

[`StaxXmlWriterSyncOptions`](#staxxmlwritersyncoptions).[`indentString`](#indentstring-1)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [StaxXmlWriterSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L20)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`StaxXmlWriterSyncOptions`](#staxxmlwritersyncoptions).[`addEntities`](#addentities-3)

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [StaxXmlWriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L21)

###### Inherited from

[`StaxXmlWriterSyncOptions`](#staxxmlwritersyncoptions).[`autoEncodeEntities`](#autoencodeentities-1)

##### namespaces?

> `optional` **namespaces?**: `NamespaceDeclaration`[]

Defined in: [StaxXmlWriterSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L22)

###### Inherited from

[`StaxXmlWriterSyncOptions`](#staxxmlwritersyncoptions).[`namespaces`](#namespaces-1)

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [StaxXmlWriterSync.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L33)

Internal character buffer size.

###### Default Value

```ts
16384
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [StaxXmlWriterSync.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L39)

Emit buffered chunks automatically when threshold is reached.

###### Default Value

```ts
true
```

##### flushOnClose?

> `optional` **flushOnClose?**: `boolean`

Defined in: [StaxXmlWriterSync.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L45)

Whether to call sink.flush() when the writer is finalized.

###### Default Value

```ts
false
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [StaxXmlWriterSync.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L52)

Flush threshold (percentage or absolute char count).
If <= 1, treated as percentage of bufferSize. Otherwise absolute char count.

###### Default Value

```ts
0.8
```

***

### XmlCursorReaderOptions

Defined in: [cursor/types.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L32)

Options for the sync cursor reader.

#### Extended by

- [`XmlCursorReaderAsyncOptions`](#xmlcursorreaderasyncoptions)

#### Properties

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [cursor/types.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L34)

Whether to automatically decode XML entities. Default: true

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [cursor/types.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L36)

Additional custom entities to decode

###### entity

> **entity**: `string`

###### value

> **value**: `string`

***

### XmlCursorReaderAsyncOptions

Defined in: [cursor/types.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L43)

Options for the async cursor reader.

#### Extends

- [`XmlCursorReaderOptions`](#xmlcursorreaderoptions)

#### Properties

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [cursor/types.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L34)

Whether to automatically decode XML entities. Default: true

###### Inherited from

[`XmlCursorReaderOptions`](#xmlcursorreaderoptions).[`autoDecodeEntities`](#autodecodeentities-2)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [cursor/types.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L36)

Additional custom entities to decode

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`XmlCursorReaderOptions`](#xmlcursorreaderoptions).[`addEntities`](#addentities-5)

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [cursor/types.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L45)

Text encoding for the input stream. Default: 'utf-8'

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

> `optional` **attributesWithPrefix?**: `Record`\<`string`, `AttributeInfo`\>

Defined in: [types.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L73)

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

> `optional` **attributes?**: `Record`\<`string`, `string` \| `AttributeInfo`\>

Defined in: [types.ts:357](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L357)

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: [types.ts:358](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L358)

##### comment?

> `optional` **comment?**: `string`

Defined in: [types.ts:359](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L359)

## Type Aliases

### CursorEventType

> **CursorEventType** = *typeof* [`CursorEventType`](#cursoreventtype)\[keyof *typeof* [`CursorEventType`](#cursoreventtype)\]

Defined in: [cursor/types.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L9)

Cursor event type constants as numeric SMI values.

Using small integers (0-6) ensures V8 treats these as Smi (Small Integer),
which avoids write barrier overhead when updating mutable cursor state.

***

### XmlEventType

> **XmlEventType** = *typeof* [`XmlEventType`](#xmleventtype-1)\[keyof *typeof* [`XmlEventType`](#xmleventtype-1)\]

Defined in: [types.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L6)

Enumeration of XML stream event types used by the StAX parser

***

### AnyXmlEvent

> **AnyXmlEvent** = `StartDocumentEvent` \| `EndDocumentEvent` \| [`StartElementEvent`](#startelementevent) \| `EndElementEvent` \| [`CharactersEvent`](#charactersevent) \| [`CdataEvent`](#cdataevent) \| [`ErrorEvent`](#errorevent)

Defined in: [types.ts:102](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L102)

Discriminated Union type for developer use

## Variables

### CursorEventType

> `const` **CursorEventType**: `object`

Defined in: [cursor/types.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L9)

Cursor event type constants as numeric SMI values.

Using small integers (0-6) ensures V8 treats these as Smi (Small Integer),
which avoids write barrier overhead when updating mutable cursor state.

#### Type Declaration

##### START\_DOCUMENT

> `readonly` **START\_DOCUMENT**: `0` = `0`

Cursor positioned before the document starts

##### END\_DOCUMENT

> `readonly` **END\_DOCUMENT**: `1` = `1`

Cursor positioned after the document ends

##### START\_ELEMENT

> `readonly` **START\_ELEMENT**: `2` = `2`

Cursor positioned at the start of an element

##### END\_ELEMENT

> `readonly` **END\_ELEMENT**: `3` = `3`

Cursor positioned at the end of an element

##### CHARACTERS

> `readonly` **CHARACTERS**: `4` = `4`

Cursor positioned at character content

##### CDATA

> `readonly` **CDATA**: `5` = `5`

Cursor positioned at a CDATA section

##### ERROR

> `readonly` **ERROR**: `6` = `6`

Cursor encountered a parse error

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

### createStaxXmlParser()

> **createStaxXmlParser**(`xmlStream`, `options?`): [`StaxXmlParser`](#staxxmlparser)

Defined in: [StaxXmlParser.ts:862](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L862)

#### Parameters

##### xmlStream

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### options?

[`StaxXmlParserOptions`](#staxxmlparseroptions) = `{}`

#### Returns

[`StaxXmlParser`](#staxxmlparser)

***

### isStartElement()

> **isStartElement**(`event`): `event is StartElementEvent`

Defined in: [types.ts:297](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L297)

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

Defined in: [types.ts:306](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L306)

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

Defined in: [types.ts:315](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L315)

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

Defined in: [types.ts:323](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L323)

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

Defined in: [types.ts:331](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L331)

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

Defined in: [types.ts:339](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L339)

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

Defined in: [types.ts:347](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L347)

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

Renames and re-exports [StaxXmlWriterSync](#staxxmlwritersync)
