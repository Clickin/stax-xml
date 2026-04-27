---
title: stax-xml
description: API reference for stax-xml
slug: v1.0.0-rc1/api/main
---

**stax-xml**

***

# stax-xml

## Classes

### StaxXmlIterableParser

Defined in: [StaxXmlIterableParser.ts:92](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L92)

#### Constructors

##### Constructor

> **new StaxXmlIterableParser**(`source`, `options?`): [`StaxXmlIterableParser`](#staxxmliterableparser)

Defined in: [StaxXmlIterableParser.ts:149](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L149)

###### Parameters

###### source

`Iterable`\<[`ByteBatch`](#bytebatch)\>

###### options?

[`StaxXmlIterableParserOptions`](#staxxmliterableparseroptions) = `{}`

###### Returns

[`StaxXmlIterableParser`](#staxxmliterableparser)

#### Methods

##### nextBatch()

> **nextBatch**(): `boolean`

Defined in: [StaxXmlIterableParser.ts:156](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L156)

###### Returns

`boolean`

##### nextBatchFrame()

> **nextBatchFrame**(): [`StaxXmlIterableBatchFrame`](#staxxmliterablebatchframe)\<`Uint8Array`\<`ArrayBufferLike`\>\> \| `undefined`

Defined in: [StaxXmlIterableParser.ts:191](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L191)

###### Returns

[`StaxXmlIterableBatchFrame`](#staxxmliterablebatchframe)\<`Uint8Array`\<`ArrayBufferLike`\>\> \| `undefined`

##### pushByteBatch()

> **pushByteBatch**(`batch`, `isFinal?`): `boolean`

Defined in: [StaxXmlIterableParser.ts:196](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L196)

**`Internal`**

Feed one byte batch without marking the source as exhausted.

###### Parameters

###### batch

[`ByteBatch`](#bytebatch)

###### isFinal?

`boolean` = `false`

###### Returns

`boolean`

##### eventCount()

> **eventCount**(): `number`

Defined in: [StaxXmlIterableParser.ts:238](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L238)

###### Returns

`number`

##### batchFrame()

> **batchFrame**(): [`StaxXmlIterableBatchFrame`](#staxxmliterablebatchframe)

Defined in: [StaxXmlIterableParser.ts:242](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L242)

###### Returns

[`StaxXmlIterableBatchFrame`](#staxxmliterablebatchframe)

##### buffer()

> **buffer**(): `Uint8Array`

Defined in: [StaxXmlIterableParser.ts:247](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L247)

###### Returns

`Uint8Array`

##### eventType()

> **eventType**(`index`): [`IterableEventType`](#iterableeventtype-1)

Defined in: [StaxXmlIterableParser.ts:251](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L251)

###### Parameters

###### index

`number`

###### Returns

[`IterableEventType`](#iterableeventtype-1)

##### nameStart()

> **nameStart**(`index`): `number`

Defined in: [StaxXmlIterableParser.ts:255](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L255)

###### Parameters

###### index

`number`

###### Returns

`number`

##### nameEnd()

> **nameEnd**(`index`): `number`

Defined in: [StaxXmlIterableParser.ts:259](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L259)

###### Parameters

###### index

`number`

###### Returns

`number`

##### textStart()

> **textStart**(`index`): `number`

Defined in: [StaxXmlIterableParser.ts:263](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L263)

###### Parameters

###### index

`number`

###### Returns

`number`

##### textEnd()

> **textEnd**(`index`): `number`

Defined in: [StaxXmlIterableParser.ts:267](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L267)

###### Parameters

###### index

`number`

###### Returns

`number`

##### attrCount()

> **attrCount**(`index`): `number`

Defined in: [StaxXmlIterableParser.ts:271](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L271)

###### Parameters

###### index

`number`

###### Returns

`number`

##### attrNameStart()

> **attrNameStart**(`eventIndex`, `attrIndex`): `number`

Defined in: [StaxXmlIterableParser.ts:275](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L275)

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`number`

##### attrNameEnd()

> **attrNameEnd**(`eventIndex`, `attrIndex`): `number`

Defined in: [StaxXmlIterableParser.ts:279](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L279)

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`number`

##### attrValueStart()

> **attrValueStart**(`eventIndex`, `attrIndex`): `number`

Defined in: [StaxXmlIterableParser.ts:283](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L283)

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`number`

##### attrValueEnd()

> **attrValueEnd**(`eventIndex`, `attrIndex`): `number`

Defined in: [StaxXmlIterableParser.ts:287](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L287)

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`number`

##### decodeSpan()

> **decodeSpan**(`start`, `end`): `string`

Defined in: [StaxXmlIterableParser.ts:291](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L291)

###### Parameters

###### start

`number`

###### end

`number`

###### Returns

`string`

##### copyName()

> **copyName**(`index`): `string` \| `undefined`

Defined in: [StaxXmlIterableParser.ts:299](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L299)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### copyText()

> **copyText**(`index`): `string` \| `undefined`

Defined in: [StaxXmlIterableParser.ts:307](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L307)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### copyAttrName()

> **copyAttrName**(`eventIndex`, `attrIndex`): `string` \| `undefined`

Defined in: [StaxXmlIterableParser.ts:312](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L312)

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`string` \| `undefined`

##### copyAttrValue()

> **copyAttrValue**(`eventIndex`, `attrIndex`): `string` \| `undefined`

Defined in: [StaxXmlIterableParser.ts:321](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L321)

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`string` \| `undefined`

##### isImplicitAttributeValue()

> **isImplicitAttributeValue**(`eventIndex`, `attrIndex`): `boolean`

Defined in: [StaxXmlIterableParser.ts:328](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L328)

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`boolean`

##### copyAttributesObject()

> **copyAttributesObject**(`eventIndex`): `Record`\<`string`, `string`\>

Defined in: [StaxXmlIterableParser.ts:337](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L337)

###### Parameters

###### eventIndex

`number`

###### Returns

`Record`\<`string`, `string`\>

***

### StaxXmlParser

Defined in: [StaxXmlParser.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L69)

#### Implements

- `AsyncIterable`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new StaxXmlParser**(`xmlStream`, `options?`): [`StaxXmlParser`](#staxxmlparser)

Defined in: [StaxXmlParser.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L73)

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

Defined in: [StaxXmlParser.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L127)

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

Defined in: [StaxXmlParser.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L81)

###### Returns

`AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`AsyncIterable.[asyncIterator]`

##### \[STAX\_XML\_EVENT\_BACKEND\]()

> **\[STAX\_XML\_EVENT\_BACKEND\]**(): `IterableEventBackendIterator`

Defined in: [StaxXmlParser.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L85)

###### Returns

`IterableEventBackendIterator`

##### next()

> **next**(): `IteratorResultLike`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [StaxXmlParser.ts:89](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L89)

###### Returns

`IteratorResultLike`\<[`AnyXmlEvent`](#anyxmlevent)\>

##### return()

> **return**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: [StaxXmlParser.ts:100](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L100)

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

##### nextBatch()

> **nextBatch**(): `Promise`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

Defined in: [StaxXmlParser.ts:104](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L104)

###### Returns

`Promise`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

##### batchedIterator()

> **batchedIterator**(): `AsyncGenerator`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

Defined in: [StaxXmlParser.ts:117](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L117)

###### Returns

`AsyncGenerator`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

***

### StaxXmlParserSync

Defined in: [StaxXmlParserSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L22)

#### Implements

- `Iterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new StaxXmlParserSync**(`xml`, `options?`): [`StaxXmlParserSync`](#staxxmlparsersync)

Defined in: [StaxXmlParserSync.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L38)

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

Defined in: [StaxXmlParserSync.ts:54](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L54)

###### Returns

`Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterable.[iterator]`

##### next()

> **next**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [StaxXmlParserSync.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L58)

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.next`

##### return()

> **return**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: [StaxXmlParserSync.ts:68](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L68)

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.return`

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

Defined in: [StaxXmlWriter.ts:292](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L292)

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

Defined in: [StaxXmlWriter.ts:317](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L317)

End document (automatically close all elements)

###### Returns

`Promise`\<`void`\>

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:338](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L338)

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

Defined in: [StaxXmlWriter.ts:430](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L430)

Write end element

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeCharacters()

> **writeCharacters**(`text`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:463](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L463)

Write text

###### Parameters

###### text

`string`

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeCData()

> **writeCData**(`cdata`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:485](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L485)

Write CDATA section

###### Parameters

###### cdata

`string`

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeComment()

> **writeComment**(`comment`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:505](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L505)

Write comment

###### Parameters

###### comment

`string`

###### Returns

`Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

##### writeRaw()

> **writeRaw**(`xml`): `Promise`\<[`StaxXmlWriter`](#staxxmlwriter)\>

Defined in: [StaxXmlWriter.ts:528](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L528)

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

Defined in: [StaxXmlWriter.ts:537](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L537)

Manual flush

###### Returns

`Promise`\<`void`\>

##### getMetrics()

> **getMetrics**(): `object`

Defined in: [StaxXmlWriter.ts:544](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriter.ts#L544)

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

Defined in: [StaxXmlWriterSync.ts:495](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L495)

String-based sync writer.

#### Extends

- `AbstractStaxXmlWriterSync`

#### Constructors

##### Constructor

> **new StaxXmlWriterSync**(`options?`): [`StaxXmlWriterSync`](#staxxmlwritersync)

Defined in: [StaxXmlWriterSync.ts:498](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L498)

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

Defined in: [StaxXmlWriterSync.ts:502](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L502)

###### Returns

`string`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: [StaxXmlWriterSync.ts:506](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L506)

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractStaxXmlWriterSync._emit`

***

### StaxXmlWriterSyncSink

Defined in: [StaxXmlWriterSync.ts:514](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L514)

Sink-based sync writer. Use this for file/buffer incremental writes.

#### Extends

- `AbstractStaxXmlWriterSync`

#### Constructors

##### Constructor

> **new StaxXmlWriterSyncSink**(`sink`, `options?`): [`StaxXmlWriterSyncSink`](#staxxmlwritersyncsink)

Defined in: [StaxXmlWriterSync.ts:522](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L522)

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

Defined in: [StaxXmlWriterSync.ts:538](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L538)

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractStaxXmlWriterSync._emit`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: [StaxXmlWriterSync.ts:579](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L579)

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Overrides

`AbstractStaxXmlWriterSync.writeEndDocument`

##### flush()

> **flush**(): `void`

Defined in: [StaxXmlWriterSync.ts:587](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L587)

###### Returns

`void`

##### close()

> **close**(): `void`

Defined in: [StaxXmlWriterSync.ts:594](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlWriterSync.ts#L594)

###### Returns

`void`

***

### StaxXmlCursorReader

Defined in: [cursor/StaxXmlCursorReader.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L15)

#### Constructors

##### Constructor

> **new StaxXmlCursorReader**(`xml`, `options?`): [`StaxXmlCursorReader`](#staxxmlcursorreader)

Defined in: [cursor/StaxXmlCursorReader.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L23)

###### Parameters

###### xml

`string`

###### options?

[`StaxXmlCursorReaderOptions`](#staxxmlcursorreaderoptions) = `{}`

###### Returns

[`StaxXmlCursorReader`](#staxxmlcursorreader)

#### Methods

##### next()

> **next**(): `boolean`

Defined in: [cursor/StaxXmlCursorReader.ts:40](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L40)

###### Returns

`boolean`

##### eventType()

> **eventType**(): [`CursorEventType`](#cursoreventtype-1)

Defined in: [cursor/StaxXmlCursorReader.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L49)

###### Returns

[`CursorEventType`](#cursoreventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReader.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L53)

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReader.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L57)

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReader.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L61)

###### Returns

`string` \| `undefined`

##### uri()

> **uri**(): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReader.ts:65](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L65)

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReader.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L69)

###### Returns

`string` \| `undefined`

##### getAttributeCount()

> **getAttributeCount**(): `number`

Defined in: [cursor/StaxXmlCursorReader.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L73)

###### Returns

`number`

##### getAttributeName()

> **getAttributeName**(`index`): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReader.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L77)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributeLocalName()

> **getAttributeLocalName**(`index`): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReader.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L81)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributePrefix()

> **getAttributePrefix**(`index`): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReader.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L85)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributeValue()

> **getAttributeValue**(`indexOrName`): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReader.ts:89](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L89)

###### Parameters

###### indexOrName

`string` \| `number`

###### Returns

`string` \| `undefined`

##### getAttributeUri()

> **getAttributeUri**(`index`): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReader.ts:93](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L93)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### depth()

> **depth**(): `number`

Defined in: [cursor/StaxXmlCursorReader.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReader.ts#L97)

###### Returns

`number`

***

### StaxXmlCursorReaderAsync

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:8](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L8)

#### Constructors

##### Constructor

> **new StaxXmlCursorReaderAsync**(`stream`, `options?`): [`StaxXmlCursorReaderAsync`](#staxxmlcursorreaderasync)

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L13)

###### Parameters

###### stream

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

[`StaxXmlCursorReaderAsyncOptions`](#staxxmlcursorreaderasyncoptions) = `{}`

###### Returns

[`StaxXmlCursorReaderAsync`](#staxxmlcursorreaderasync)

#### Methods

##### next()

> **next**(): `Promise`\<`boolean`\>

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L31)

###### Returns

`Promise`\<`boolean`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:47](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L47)

###### Returns

`Promise`\<`void`\>

##### eventType()

> **eventType**(): [`CursorEventType`](#cursoreventtype-1)

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L53)

###### Returns

[`CursorEventType`](#cursoreventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L57)

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L61)

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:65](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L65)

###### Returns

`string` \| `undefined`

##### uri()

> **uri**(): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L69)

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L73)

###### Returns

`string` \| `undefined`

##### getAttributeCount()

> **getAttributeCount**(): `number`

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L77)

###### Returns

`number`

##### getAttributeName()

> **getAttributeName**(`index`): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L81)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributeLocalName()

> **getAttributeLocalName**(`index`): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L85)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributePrefix()

> **getAttributePrefix**(`index`): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:89](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L89)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributeValue()

> **getAttributeValue**(`indexOrName`): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:93](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L93)

###### Parameters

###### indexOrName

`string` \| `number`

###### Returns

`string` \| `undefined`

##### getAttributeUri()

> **getAttributeUri**(`index`): `string` \| `undefined`

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L97)

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### depth()

> **depth**(): `number`

Defined in: [cursor/StaxXmlCursorReaderAsync.ts:101](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts#L101)

###### Returns

`number`

## Interfaces

### ByteBatchOptions

Defined in: [StaxXmlIterableParser.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L14)

#### Properties

##### batchSize?

> `optional` **batchSize?**: `number`

Defined in: [StaxXmlIterableParser.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L15)

***

### StaxXmlIterableParserOptions

Defined in: [StaxXmlIterableParser.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L18)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [StaxXmlIterableParser.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L19)

##### incompleteFinalMarkupMessage?

> `optional` **incompleteFinalMarkupMessage?**: `string`

Defined in: [StaxXmlIterableParser.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L20)

##### emitStartDocumentBatchImmediately?

> `optional` **emitStartDocumentBatchImmediately?**: `boolean`

Defined in: [StaxXmlIterableParser.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L21)

***

### StaxXmlIterableBatchFrame

Defined in: [StaxXmlIterableParser.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L30)

Reusable low-level view over the current iterable parser batch.

The object and typed-array fields are owned by the parser and are only valid
until the next nextBatch()/nextBatchFrame() call.

#### Type Parameters

##### BufferType

`BufferType` *extends* `Uint8Array` = `Uint8Array`

#### Properties

##### eventCount

> **eventCount**: `number`

Defined in: [StaxXmlIterableParser.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L31)

##### attrCount

> **attrCount**: `number`

Defined in: [StaxXmlIterableParser.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L32)

##### buffer

> **buffer**: `BufferType`

Defined in: [StaxXmlIterableParser.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L33)

##### eventTypes

> **eventTypes**: `Uint8Array`

Defined in: [StaxXmlIterableParser.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L34)

##### nameStarts

> **nameStarts**: `Int32Array`

Defined in: [StaxXmlIterableParser.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L35)

##### nameEnds

> **nameEnds**: `Int32Array`

Defined in: [StaxXmlIterableParser.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L36)

##### nameIds

> **nameIds**: `Int32Array`

Defined in: [StaxXmlIterableParser.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L37)

##### textStarts

> **textStarts**: `Int32Array`

Defined in: [StaxXmlIterableParser.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L38)

##### textEnds

> **textEnds**: `Int32Array`

Defined in: [StaxXmlIterableParser.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L39)

##### attrStarts

> **attrStarts**: `Int32Array`

Defined in: [StaxXmlIterableParser.ts:40](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L40)

##### attrCounts

> **attrCounts**: `Int32Array`

Defined in: [StaxXmlIterableParser.ts:41](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L41)

##### attrNameStarts

> **attrNameStarts**: `Int32Array`

Defined in: [StaxXmlIterableParser.ts:42](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L42)

##### attrNameEnds

> **attrNameEnds**: `Int32Array`

Defined in: [StaxXmlIterableParser.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L43)

##### attrNameIds

> **attrNameIds**: `Int32Array`

Defined in: [StaxXmlIterableParser.ts:44](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L44)

##### attrValueStarts

> **attrValueStarts**: `Int32Array`

Defined in: [StaxXmlIterableParser.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L45)

##### attrValueEnds

> **attrValueEnds**: `Int32Array`

Defined in: [StaxXmlIterableParser.ts:46](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L46)

***

### StaxXmlParserOptions

Defined in: [StaxXmlParser.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L18)

Configuration options for the StaxXmlParser

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [StaxXmlParser.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L23)

Text encoding for the input stream

###### Default Value

```ts
'utf-8'
```

##### addEntities?

> `optional` **addEntities?**: `EntityDefinition`[]

Defined in: [StaxXmlParser.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L29)

Additional custom entities to decode

###### Default Value

```ts
[]
```

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [StaxXmlParser.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L35)

Whether to automatically decode XML entities

###### Default Value

```ts
true
```

##### maxBufferSize?

> `optional` **maxBufferSize?**: `number`

Defined in: [StaxXmlParser.ts:44](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L44)

Maximum buffer size in bytes

###### Default Value

```ts
65536
```

###### Remarks

Retained for API compatibility. The iterable backend owns chunk buffering.

##### enableBufferCompaction?

> `optional` **enableBufferCompaction?**: `boolean`

Defined in: [StaxXmlParser.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L53)

Whether to enable buffer compaction for memory efficiency

###### Default Value

```ts
true
```

###### Remarks

Retained for API compatibility. The iterable backend owns chunk buffering.

##### initialQueueCapacity?

> `optional` **initialQueueCapacity?**: `number`

Defined in: [StaxXmlParser.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L62)

Initial event queue capacity

###### Default Value

```ts
1024
```

###### Remarks

Retained for API compatibility. The iterable backend exposes materialized batches directly.

##### eventFilter?

> `optional` **eventFilter?**: `ParserEventFilter`

Defined in: [StaxXmlParser.ts:64](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L64)

***

### StaxXmlParserSyncOptions

Defined in: [StaxXmlParserSync.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L14)

#### Properties

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [StaxXmlParserSync.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L15)

##### addEntities?

> `optional` **addEntities?**: `EntityDefinition`[]

Defined in: [StaxXmlParserSync.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L16)

##### eventFilter?

> `optional` **eventFilter?**: `ParserEventFilter`

Defined in: [StaxXmlParserSync.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParserSync.ts#L17)

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

[`StaxXmlWriterSyncOptions`](#staxxmlwritersyncoptions).[`encoding`](#encoding-3)

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

### StaxXmlCursorReaderOptions

Defined in: [cursor/types.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L32)

Options for the sync cursor reader.

#### Extended by

- [`StaxXmlCursorReaderAsyncOptions`](#staxxmlcursorreaderasyncoptions)

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

### StaxXmlCursorReaderAsyncOptions

Defined in: [cursor/types.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L43)

Options for the async cursor reader.

#### Extends

- [`StaxXmlCursorReaderOptions`](#staxxmlcursorreaderoptions)

#### Properties

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [cursor/types.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L34)

Whether to automatically decode XML entities. Default: true

###### Inherited from

[`StaxXmlCursorReaderOptions`](#staxxmlcursorreaderoptions).[`autoDecodeEntities`](#autodecodeentities-2)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [cursor/types.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L36)

Additional custom entities to decode

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`StaxXmlCursorReaderOptions`](#staxxmlcursorreaderoptions).[`addEntities`](#addentities-5)

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

### IterableEventType

> **IterableEventType** = *typeof* [`IterableEventType`](#iterableeventtype)\[keyof *typeof* [`IterableEventType`](#iterableeventtype)\]

Defined in: [StaxXmlIterableParser.ts:1](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L1)

***

### ByteBatch

> **ByteBatch** = readonly `Uint8Array`[]

Defined in: [StaxXmlIterableParser.ts:12](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L12)

***

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

### IterableEventType

> `const` **IterableEventType**: `object`

Defined in: [StaxXmlIterableParser.ts:1](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L1)

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

### toByteBatches()

> **toByteBatches**(`source`, `options?`): `Iterable`\<[`ByteBatch`](#bytebatch)\>

Defined in: [StaxXmlIterableParser.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L52)

#### Parameters

##### source

`Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### options?

[`ByteBatchOptions`](#bytebatchoptions) = `{}`

#### Returns

`Iterable`\<[`ByteBatch`](#bytebatch)\>

***

### toAsyncByteBatches()

> **toAsyncByteBatches**(`source`, `options?`): `AsyncIterable`\<[`ByteBatch`](#bytebatch)\>

Defined in: [StaxXmlIterableParser.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlIterableParser.ts#L72)

#### Parameters

##### source

`AsyncIterable`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### options?

[`ByteBatchOptions`](#bytebatchoptions) = `{}`

#### Returns

`AsyncIterable`\<[`ByteBatch`](#bytebatch)\>

***

### createStaxXmlParser()

> **createStaxXmlParser**(`xmlStream`, `options?`): [`StaxXmlParser`](#staxxmlparser)

Defined in: [StaxXmlParser.ts:132](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/StaxXmlParser.ts#L132)

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
