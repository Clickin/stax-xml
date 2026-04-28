---
title: stax-xml
description: API reference for stax-xml
---

**stax-xml**

***

# stax-xml

## Classes

### EventReader

Defined in: packages/stax-xml/src/EventReader.ts:77

#### Implements

- `AsyncIterable`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReader**(`xmlStream`, `options?`): [`EventReader`](#eventreader)

Defined in: packages/stax-xml/src/EventReader.ts:81

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

Defined in: packages/stax-xml/src/EventReader.ts:136

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

Defined in: packages/stax-xml/src/EventReader.ts:89

###### Returns

`AsyncIterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`AsyncIterable.[asyncIterator]`

##### next()

> **next**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\> \| `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: packages/stax-xml/src/EventReader.ts:98

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\> \| `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

##### return()

> **return**(): `Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

Defined in: packages/stax-xml/src/EventReader.ts:109

###### Returns

`Promise`\<`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent), `any`\>\>

##### nextBatch()

> **nextBatch**(): `Promise`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

Defined in: packages/stax-xml/src/EventReader.ts:113

###### Returns

`Promise`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

##### batchedIterator()

> **batchedIterator**(): `AsyncGenerator`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

Defined in: packages/stax-xml/src/EventReader.ts:126

###### Returns

`AsyncGenerator`\<[`AnyXmlEvent`](#anyxmlevent)[]\>

***

### EventReaderSync

Defined in: packages/stax-xml/src/EventReaderSync.ts:28

#### Implements

- `Iterable`\<[`AnyXmlEvent`](#anyxmlevent)\>
- `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

#### Constructors

##### Constructor

> **new EventReaderSync**(`xml`, `options?`): [`EventReaderSync`](#eventreadersync)

Defined in: packages/stax-xml/src/EventReaderSync.ts:44

###### Parameters

###### xml

`string`

###### options?

[`EventReaderSyncOptions`](#eventreadersyncoptions) = `{}`

###### Returns

[`EventReaderSync`](#eventreadersync)

#### Methods

##### \[iterator\]()

> **\[iterator\]**(): `Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: packages/stax-xml/src/EventReaderSync.ts:87

###### Returns

`Iterator`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterable.[iterator]`

##### next()

> **next**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: packages/stax-xml/src/EventReaderSync.ts:91

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.next`

##### return()

> **return**(): `IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

Defined in: packages/stax-xml/src/EventReaderSync.ts:101

###### Returns

`IteratorResult`\<[`AnyXmlEvent`](#anyxmlevent)\>

###### Implementation of

`Iterator.return`

***

### IterableReader

Defined in: packages/stax-xml/src/IterableReader.ts:103

#### Constructors

##### Constructor

> **new IterableReader**(`source`, `options?`): [`IterableReader`](#iterablereader)

Defined in: packages/stax-xml/src/IterableReader.ts:165

###### Parameters

###### source

`Iterable`\<[`ByteBatch`](#bytebatch)\>

###### options?

[`IterableReaderOptions`](#iterablereaderoptions)

###### Returns

[`IterableReader`](#iterablereader)

#### Methods

##### nextBatch()

> **nextBatch**(): `boolean`

Defined in: packages/stax-xml/src/IterableReader.ts:200

###### Returns

`boolean`

##### nextBatchFrame()

> **nextBatchFrame**(): [`IterableReaderBatchFrame`](#iterablereaderbatchframe)\<`Uint8Array`\<`ArrayBufferLike`\>\> \| `undefined`

Defined in: packages/stax-xml/src/IterableReader.ts:239

###### Returns

[`IterableReaderBatchFrame`](#iterablereaderbatchframe)\<`Uint8Array`\<`ArrayBufferLike`\>\> \| `undefined`

##### eventCount()

> **eventCount**(): `number`

Defined in: packages/stax-xml/src/IterableReader.ts:290

###### Returns

`number`

##### batchFrame()

> **batchFrame**(): [`IterableReaderBatchFrame`](#iterablereaderbatchframe)

Defined in: packages/stax-xml/src/IterableReader.ts:297

###### Returns

[`IterableReaderBatchFrame`](#iterablereaderbatchframe)

##### buffer()

> **buffer**(): `Uint8Array`

Defined in: packages/stax-xml/src/IterableReader.ts:305

###### Returns

`Uint8Array`

##### eventType()

> **eventType**(`index`): [`IterableEventType`](#iterableeventtype-1)

Defined in: packages/stax-xml/src/IterableReader.ts:312

###### Parameters

###### index

`number`

###### Returns

[`IterableEventType`](#iterableeventtype-1)

##### nameStart()

> **nameStart**(`index`): `number`

Defined in: packages/stax-xml/src/IterableReader.ts:319

###### Parameters

###### index

`number`

###### Returns

`number`

##### nameEnd()

> **nameEnd**(`index`): `number`

Defined in: packages/stax-xml/src/IterableReader.ts:326

###### Parameters

###### index

`number`

###### Returns

`number`

##### textStart()

> **textStart**(`index`): `number`

Defined in: packages/stax-xml/src/IterableReader.ts:333

###### Parameters

###### index

`number`

###### Returns

`number`

##### textEnd()

> **textEnd**(`index`): `number`

Defined in: packages/stax-xml/src/IterableReader.ts:340

###### Parameters

###### index

`number`

###### Returns

`number`

##### attrCount()

> **attrCount**(`index`): `number`

Defined in: packages/stax-xml/src/IterableReader.ts:347

###### Parameters

###### index

`number`

###### Returns

`number`

##### attrNameStart()

> **attrNameStart**(`eventIndex`, `attrIndex`): `number`

Defined in: packages/stax-xml/src/IterableReader.ts:354

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`number`

##### attrNameEnd()

> **attrNameEnd**(`eventIndex`, `attrIndex`): `number`

Defined in: packages/stax-xml/src/IterableReader.ts:361

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`number`

##### attrValueStart()

> **attrValueStart**(`eventIndex`, `attrIndex`): `number`

Defined in: packages/stax-xml/src/IterableReader.ts:368

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`number`

##### attrValueEnd()

> **attrValueEnd**(`eventIndex`, `attrIndex`): `number`

Defined in: packages/stax-xml/src/IterableReader.ts:375

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`number`

##### decodeSpan()

> **decodeSpan**(`start`, `end`): `string`

Defined in: packages/stax-xml/src/IterableReader.ts:382

###### Parameters

###### start

`number`

###### end

`number`

###### Returns

`string`

##### copyName()

> **copyName**(`index`): `string` \| `undefined`

Defined in: packages/stax-xml/src/IterableReader.ts:398

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### copyText()

> **copyText**(`index`): `string` \| `undefined`

Defined in: packages/stax-xml/src/IterableReader.ts:409

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### copyAttrName()

> **copyAttrName**(`eventIndex`, `attrIndex`): `string` \| `undefined`

Defined in: packages/stax-xml/src/IterableReader.ts:417

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`string` \| `undefined`

##### copyAttrValue()

> **copyAttrValue**(`eventIndex`, `attrIndex`): `string` \| `undefined`

Defined in: packages/stax-xml/src/IterableReader.ts:429

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`string` \| `undefined`

##### isImplicitAttributeValue()

> **isImplicitAttributeValue**(`eventIndex`, `attrIndex`): `boolean`

Defined in: packages/stax-xml/src/IterableReader.ts:439

###### Parameters

###### eventIndex

`number`

###### attrIndex

`number`

###### Returns

`boolean`

##### copyAttributesObject()

> **copyAttributesObject**(`eventIndex`): `Record`\<`string`, `string`\>

Defined in: packages/stax-xml/src/IterableReader.ts:451

###### Parameters

###### eventIndex

`number`

###### Returns

`Record`\<`string`, `string`\>

***

### Writer

Defined in: packages/stax-xml/src/Writer.ts:131

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

Defined in: packages/stax-xml/src/Writer.ts:170

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

Defined in: packages/stax-xml/src/Writer.ts:292

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

Defined in: packages/stax-xml/src/Writer.ts:317

End document (automatically close all elements)

###### Returns

`Promise`\<`void`\>

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `Promise`\<[`Writer`](#writer)\>

Defined in: packages/stax-xml/src/Writer.ts:338

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

Defined in: packages/stax-xml/src/Writer.ts:430

Write end element

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCharacters()

> **writeCharacters**(`text`): `Promise`\<[`Writer`](#writer)\>

Defined in: packages/stax-xml/src/Writer.ts:463

Write text

###### Parameters

###### text

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCData()

> **writeCData**(`cdata`): `Promise`\<[`Writer`](#writer)\>

Defined in: packages/stax-xml/src/Writer.ts:485

Write CDATA section

###### Parameters

###### cdata

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeComment()

> **writeComment**(`comment`): `Promise`\<[`Writer`](#writer)\>

Defined in: packages/stax-xml/src/Writer.ts:505

Write comment

###### Parameters

###### comment

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeRaw()

> **writeRaw**(`xml`): `Promise`\<[`Writer`](#writer)\>

Defined in: packages/stax-xml/src/Writer.ts:528

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

Defined in: packages/stax-xml/src/Writer.ts:537

Manual flush

###### Returns

`Promise`\<`void`\>

##### getMetrics()

> **getMetrics**(): `object`

Defined in: packages/stax-xml/src/Writer.ts:544

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

Defined in: packages/stax-xml/src/WriterSync.ts:493

String-based sync writer.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSync**(`options?`): [`WriterSync`](#writersync)

Defined in: packages/stax-xml/src/WriterSync.ts:496

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

Defined in: packages/stax-xml/src/WriterSync.ts:78

###### Inherited from

`AbstractWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[] = `[]`

Defined in: packages/stax-xml/src/WriterSync.ts:79

###### Inherited from

`AbstractWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[] = `[]`

Defined in: packages/stax-xml/src/WriterSync.ts:80

###### Inherited from

`AbstractWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[] = `[]`

Defined in: packages/stax-xml/src/WriterSync.ts:81

###### Inherited from

`AbstractWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[] = `[]`

Defined in: packages/stax-xml/src/WriterSync.ts:82

###### Inherited from

`AbstractWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`WriterSyncOptions`](#writersyncoptions)\>

Defined in: packages/stax-xml/src/WriterSync.ts:83

###### Inherited from

`AbstractWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number` = `0`

Defined in: packages/stax-xml/src/WriterSync.ts:84

###### Inherited from

`AbstractWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean` = `false`

Defined in: packages/stax-xml/src/WriterSync.ts:85

###### Inherited from

`AbstractWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: packages/stax-xml/src/WriterSync.ts:86

###### Inherited from

`AbstractWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:133

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

Defined in: packages/stax-xml/src/WriterSync.ts:158

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Inherited from

`AbstractWriterSync.writeEndDocument`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:170

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

Defined in: packages/stax-xml/src/WriterSync.ts:249

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

Defined in: packages/stax-xml/src/WriterSync.ts:259

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

Defined in: packages/stax-xml/src/WriterSync.ts:276

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:290

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:307

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:322

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

Defined in: packages/stax-xml/src/WriterSync.ts:344

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:350

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:382

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:387

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: packages/stax-xml/src/WriterSync.ts:393

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: packages/stax-xml/src/WriterSync.ts:397

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: packages/stax-xml/src/WriterSync.ts:419

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: packages/stax-xml/src/WriterSync.ts:437

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._writeNewline`

##### getXmlString()

> **getXmlString**(): `string`

Defined in: packages/stax-xml/src/WriterSync.ts:500

###### Returns

`string`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: packages/stax-xml/src/WriterSync.ts:504

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractWriterSync._emit`

***

### WriterSyncSink

Defined in: packages/stax-xml/src/WriterSync.ts:512

Sink-based sync writer. Use this for file/buffer incremental writes.

#### Extends

- `AbstractWriterSync`

#### Constructors

##### Constructor

> **new WriterSyncSink**(`sink`, `options?`): [`WriterSyncSink`](#writersyncsink)

Defined in: packages/stax-xml/src/WriterSync.ts:520

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

Defined in: packages/stax-xml/src/WriterSync.ts:78

###### Inherited from

`AbstractWriterSync.state`

##### elementStack

> `protected` **elementStack**: `string`[] = `[]`

Defined in: packages/stax-xml/src/WriterSync.ts:79

###### Inherited from

`AbstractWriterSync.elementStack`

##### hasTextContentStack

> `protected` **hasTextContentStack**: `boolean`[] = `[]`

Defined in: packages/stax-xml/src/WriterSync.ts:80

###### Inherited from

`AbstractWriterSync.hasTextContentStack`

##### namespaceStack

> `protected` **namespaceStack**: `Map`\<`string`, `string`\>[] = `[]`

Defined in: packages/stax-xml/src/WriterSync.ts:81

###### Inherited from

`AbstractWriterSync.namespaceStack`

##### namespaceOwnedStack

> `protected` **namespaceOwnedStack**: `boolean`[] = `[]`

Defined in: packages/stax-xml/src/WriterSync.ts:82

###### Inherited from

`AbstractWriterSync.namespaceOwnedStack`

##### options

> `protected` `readonly` **options**: `Required`\<[`WriterSyncOptions`](#writersyncoptions)\>

Defined in: packages/stax-xml/src/WriterSync.ts:83

###### Inherited from

`AbstractWriterSync.options`

##### currentIndentLevel

> `protected` **currentIndentLevel**: `number` = `0`

Defined in: packages/stax-xml/src/WriterSync.ts:84

###### Inherited from

`AbstractWriterSync.currentIndentLevel`

##### needsIndent

> `protected` **needsIndent**: `boolean` = `false`

Defined in: packages/stax-xml/src/WriterSync.ts:85

###### Inherited from

`AbstractWriterSync.needsIndent`

##### indentCache

> `protected` **indentCache**: `string`[]

Defined in: packages/stax-xml/src/WriterSync.ts:86

###### Inherited from

`AbstractWriterSync.indentCache`

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:133

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

Defined in: packages/stax-xml/src/WriterSync.ts:170

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

Defined in: packages/stax-xml/src/WriterSync.ts:249

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

Defined in: packages/stax-xml/src/WriterSync.ts:259

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

Defined in: packages/stax-xml/src/WriterSync.ts:276

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCharacters`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:290

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeCData`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:307

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeComment`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:322

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

Defined in: packages/stax-xml/src/WriterSync.ts:344

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeRaw`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:350

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.writeEndElement`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:382

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setPrettyPrint`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: packages/stax-xml/src/WriterSync.ts:387

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

`AbstractWriterSync.setIndentString`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: packages/stax-xml/src/WriterSync.ts:393

###### Returns

`boolean`

###### Inherited from

`AbstractWriterSync.isPrettyPrintEnabled`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: packages/stax-xml/src/WriterSync.ts:397

###### Returns

`string`

###### Inherited from

`AbstractWriterSync.getIndentString`

##### \_closeStartElementTag()

> `protected` **\_closeStartElementTag**(): `void`

Defined in: packages/stax-xml/src/WriterSync.ts:419

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._closeStartElementTag`

##### \_writeNewline()

> `protected` **\_writeNewline**(): `void`

Defined in: packages/stax-xml/src/WriterSync.ts:437

###### Returns

`void`

###### Inherited from

`AbstractWriterSync._writeNewline`

##### \_emit()

> `protected` **\_emit**(`chunk`): `void`

Defined in: packages/stax-xml/src/WriterSync.ts:536

###### Parameters

###### chunk

`string`

###### Returns

`void`

###### Overrides

`AbstractWriterSync._emit`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: packages/stax-xml/src/WriterSync.ts:577

Indicates the end of the document and automatically closes all open elements.

###### Returns

`void`

###### Overrides

`AbstractWriterSync.writeEndDocument`

##### flush()

> **flush**(): `void`

Defined in: packages/stax-xml/src/WriterSync.ts:585

###### Returns

`void`

##### close()

> **close**(): `void`

Defined in: packages/stax-xml/src/WriterSync.ts:592

###### Returns

`void`

***

### CursorReader

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:20

#### Constructors

##### Constructor

> **new CursorReader**(`xml`, `options?`): [`CursorReader`](#cursorreader)

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:35

###### Parameters

###### xml

`string`

###### options?

[`CursorReaderOptions`](#cursorreaderoptions) = `{}`

###### Returns

[`CursorReader`](#cursorreader)

#### Methods

##### next()

> **next**(): `boolean`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:80

###### Returns

`boolean`

##### eventType()

> **eventType**(): [`CursorEventType`](#cursoreventtype-1)

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:93

###### Returns

[`CursorEventType`](#cursoreventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:97

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:101

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:105

###### Returns

`string` \| `undefined`

##### uri()

> **uri**(): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:109

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:113

###### Returns

`string` \| `undefined`

##### getAttributeCount()

> **getAttributeCount**(): `number`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:117

###### Returns

`number`

##### getAttributeName()

> **getAttributeName**(`index`): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:121

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributeLocalName()

> **getAttributeLocalName**(`index`): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:125

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributePrefix()

> **getAttributePrefix**(`index`): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:129

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributeValue()

> **getAttributeValue**(`indexOrName`): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:133

###### Parameters

###### indexOrName

`string` \| `number`

###### Returns

`string` \| `undefined`

##### getAttributeUri()

> **getAttributeUri**(`index`): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:137

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### depth()

> **depth**(): `number`

Defined in: packages/stax-xml/src/cursor/CursorReader.ts:141

###### Returns

`number`

***

### CursorReaderAsync

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:11

#### Constructors

##### Constructor

> **new CursorReaderAsync**(`stream`, `options?`): [`CursorReaderAsync`](#cursorreaderasync)

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:24

###### Parameters

###### stream

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

[`CursorReaderAsyncOptions`](#cursorreaderasyncoptions) = `{}`

###### Returns

[`CursorReaderAsync`](#cursorreaderasync)

#### Methods

##### next()

> **next**(): `Promise`\<`boolean`\>

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:59

###### Returns

`Promise`\<`boolean`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:79

###### Returns

`Promise`\<`void`\>

##### eventType()

> **eventType**(): [`CursorEventType`](#cursoreventtype-1)

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:90

###### Returns

[`CursorEventType`](#cursoreventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:94

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:98

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:102

###### Returns

`string` \| `undefined`

##### uri()

> **uri**(): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:106

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:110

###### Returns

`string` \| `undefined`

##### getAttributeCount()

> **getAttributeCount**(): `number`

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:114

###### Returns

`number`

##### getAttributeName()

> **getAttributeName**(`index`): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:118

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributeLocalName()

> **getAttributeLocalName**(`index`): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:122

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributePrefix()

> **getAttributePrefix**(`index`): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:126

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### getAttributeValue()

> **getAttributeValue**(`indexOrName`): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:130

###### Parameters

###### indexOrName

`string` \| `number`

###### Returns

`string` \| `undefined`

##### getAttributeUri()

> **getAttributeUri**(`index`): `string` \| `undefined`

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:134

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### depth()

> **depth**(): `number`

Defined in: packages/stax-xml/src/cursor/CursorReaderAsync.ts:138

###### Returns

`number`

## Interfaces

### EventReaderOptions

Defined in: packages/stax-xml/src/EventReader.ts:19

Configuration options for the EventReader

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: packages/stax-xml/src/EventReader.ts:24

Text encoding for the input stream

###### Default Value

```ts
'utf-8'
```

##### addEntities?

> `optional` **addEntities?**: [`EntityDefinition`](#entitydefinition)[]

Defined in: packages/stax-xml/src/EventReader.ts:30

Additional custom entities to decode

###### Default Value

```ts
[]
```

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: packages/stax-xml/src/EventReader.ts:36

Whether to automatically decode XML entities

###### Default Value

```ts
true
```

##### maxBufferSize?

> `optional` **maxBufferSize?**: `number`

Defined in: packages/stax-xml/src/EventReader.ts:45

Maximum buffer size in bytes

###### Default Value

```ts
65536
```

###### Remarks

Retained for API compatibility. The iterable backend owns chunk buffering.

##### enableBufferCompaction?

> `optional` **enableBufferCompaction?**: `boolean`

Defined in: packages/stax-xml/src/EventReader.ts:54

Whether to enable buffer compaction for memory efficiency

###### Default Value

```ts
true
```

###### Remarks

Retained for API compatibility. The iterable backend owns chunk buffering.

##### initialQueueCapacity?

> `optional` **initialQueueCapacity?**: `number`

Defined in: packages/stax-xml/src/EventReader.ts:63

Initial event queue capacity

###### Default Value

```ts
1024
```

###### Remarks

Retained for API compatibility. The iterable backend exposes materialized batches directly.

##### eventFilter?

> `optional` **eventFilter?**: [`ParserEventFilter`](#parsereventfilter)

Defined in: packages/stax-xml/src/EventReader.ts:65

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-5)

Defined in: packages/stax-xml/src/EventReader.ts:72

XML document conformance mode.

###### Default Value

```ts
'fragment'
```

##### fallbackOnParseError?

> `optional` **fallbackOnParseError?**: `boolean`

Defined in: packages/stax-xml/src/EventReader.ts:74

***

### EventReaderSyncOptions

Defined in: packages/stax-xml/src/EventReaderSync.ts:18

#### Properties

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: packages/stax-xml/src/EventReaderSync.ts:19

##### addEntities?

> `optional` **addEntities?**: [`EntityDefinition`](#entitydefinition)[]

Defined in: packages/stax-xml/src/EventReaderSync.ts:20

##### eventFilter?

> `optional` **eventFilter?**: [`ParserEventFilter`](#parsereventfilter)

Defined in: packages/stax-xml/src/EventReaderSync.ts:21

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-5)

Defined in: packages/stax-xml/src/EventReaderSync.ts:22

##### fallbackOnParseError?

> `optional` **fallbackOnParseError?**: `boolean`

Defined in: packages/stax-xml/src/EventReaderSync.ts:23

***

### EntityDefinition

Defined in: [packages/stax-xml/src/IterableEventBackend.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/IterableEventBackend.ts#L25)

#### Properties

##### entity

> **entity**: `string`

Defined in: [packages/stax-xml/src/IterableEventBackend.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/IterableEventBackend.ts#L26)

##### value

> **value**: `string`

Defined in: [packages/stax-xml/src/IterableEventBackend.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/IterableEventBackend.ts#L27)

***

### ByteBatchOptions

Defined in: packages/stax-xml/src/IterableReader.ts:21

#### Properties

##### batchSize?

> `optional` **batchSize?**: `number`

Defined in: packages/stax-xml/src/IterableReader.ts:22

***

### IterableReaderOptions

Defined in: packages/stax-xml/src/IterableReader.ts:25

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: packages/stax-xml/src/IterableReader.ts:26

##### incompleteFinalMarkupMessage?

> `optional` **incompleteFinalMarkupMessage?**: `string`

Defined in: packages/stax-xml/src/IterableReader.ts:27

##### emitStartDocumentBatchImmediately?

> `optional` **emitStartDocumentBatchImmediately?**: `boolean`

Defined in: packages/stax-xml/src/IterableReader.ts:28

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-5)

Defined in: packages/stax-xml/src/IterableReader.ts:29

##### fallbackOnParseError?

> `optional` **fallbackOnParseError?**: `boolean`

Defined in: packages/stax-xml/src/IterableReader.ts:30

***

### IterableReaderBatchFrame

Defined in: packages/stax-xml/src/IterableReader.ts:39

Reusable low-level view over the current iterable parser batch.

The object and typed-array fields are owned by the parser and are only valid
until the next nextBatch()/nextBatchFrame() call.

#### Type Parameters

##### BufferType

`BufferType` *extends* `Uint8Array` = `Uint8Array`

#### Properties

##### eventCount

> **eventCount**: `number`

Defined in: packages/stax-xml/src/IterableReader.ts:40

##### attrCount

> **attrCount**: `number`

Defined in: packages/stax-xml/src/IterableReader.ts:41

##### buffer

> **buffer**: `BufferType`

Defined in: packages/stax-xml/src/IterableReader.ts:42

##### eventTypes

> **eventTypes**: `Uint8Array`

Defined in: packages/stax-xml/src/IterableReader.ts:43

##### nameStarts

> **nameStarts**: `Int32Array`

Defined in: packages/stax-xml/src/IterableReader.ts:44

##### nameEnds

> **nameEnds**: `Int32Array`

Defined in: packages/stax-xml/src/IterableReader.ts:45

##### nameIds

> **nameIds**: `Int32Array`

Defined in: packages/stax-xml/src/IterableReader.ts:46

##### textStarts

> **textStarts**: `Int32Array`

Defined in: packages/stax-xml/src/IterableReader.ts:47

##### textEnds

> **textEnds**: `Int32Array`

Defined in: packages/stax-xml/src/IterableReader.ts:48

##### attrStarts

> **attrStarts**: `Int32Array`

Defined in: packages/stax-xml/src/IterableReader.ts:49

##### attrCounts

> **attrCounts**: `Int32Array`

Defined in: packages/stax-xml/src/IterableReader.ts:50

##### attrNameStarts

> **attrNameStarts**: `Int32Array`

Defined in: packages/stax-xml/src/IterableReader.ts:51

##### attrNameEnds

> **attrNameEnds**: `Int32Array`

Defined in: packages/stax-xml/src/IterableReader.ts:52

##### attrNameIds

> **attrNameIds**: `Int32Array`

Defined in: packages/stax-xml/src/IterableReader.ts:53

##### attrValueStarts

> **attrValueStarts**: `Int32Array`

Defined in: packages/stax-xml/src/IterableReader.ts:54

##### attrValueEnds

> **attrValueEnds**: `Int32Array`

Defined in: packages/stax-xml/src/IterableReader.ts:55

***

### WriterOptions

Defined in: packages/stax-xml/src/Writer.ts:20

Configuration options for the Writer

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: packages/stax-xml/src/Writer.ts:25

Text encoding for the output stream

###### Default Value

```ts
'utf-8'
```

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: packages/stax-xml/src/Writer.ts:31

Whether to format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString?**: `string`

Defined in: packages/stax-xml/src/Writer.ts:37

String used for indentation when prettyPrint is true

###### Default Value

```ts
'  '
```

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: packages/stax-xml/src/Writer.ts:43

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

Defined in: packages/stax-xml/src/Writer.ts:49

Whether to automatically encode XML entities

###### Default Value

```ts
true
```

##### namespaces?

> `optional` **namespaces?**: [`NamespaceDeclaration`](#namespacedeclaration)[]

Defined in: packages/stax-xml/src/Writer.ts:55

Namespace declarations to include

###### Default Value

```ts
[]
```

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: packages/stax-xml/src/Writer.ts:61

Internal buffer size in bytes

###### Default Value

```ts
16384
```

##### highWaterMark?

> `optional` **highWaterMark?**: `number`

Defined in: packages/stax-xml/src/Writer.ts:67

WritableStream backpressure threshold

###### Default Value

```ts
65536
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: packages/stax-xml/src/Writer.ts:73

Automatic flush threshold (percentage of bufferSize)

###### Default Value

```ts
0.8
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: packages/stax-xml/src/Writer.ts:79

Whether to enable automatic flushing

###### Default Value

```ts
true
```

***

### SyncTextSink

Defined in: packages/stax-xml/src/WriterSync.ts:7

Sink interface for custom sync targets.

#### Methods

##### write()

> **write**(`chunk`): `void`

Defined in: packages/stax-xml/src/WriterSync.ts:8

###### Parameters

###### chunk

`string`

###### Returns

`void`

##### flush()?

> `optional` **flush**(): `void`

Defined in: packages/stax-xml/src/WriterSync.ts:9

###### Returns

`void`

##### close()?

> `optional` **close**(): `void`

Defined in: packages/stax-xml/src/WriterSync.ts:10

###### Returns

`void`

***

### WriterSyncOptions

Defined in: packages/stax-xml/src/WriterSync.ts:16

Writer output options shared by string and sink variants.

#### Extended by

- [`WriterSyncSinkOptions`](#writersyncsinkoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: packages/stax-xml/src/WriterSync.ts:17

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: packages/stax-xml/src/WriterSync.ts:18

##### indentString?

> `optional` **indentString?**: `string`

Defined in: packages/stax-xml/src/WriterSync.ts:19

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: packages/stax-xml/src/WriterSync.ts:20

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: packages/stax-xml/src/WriterSync.ts:21

##### namespaces?

> `optional` **namespaces?**: [`NamespaceDeclaration`](#namespacedeclaration)[]

Defined in: packages/stax-xml/src/WriterSync.ts:22

***

### WriterSyncSinkOptions

Defined in: packages/stax-xml/src/WriterSync.ts:28

Writer options for sink-based sync mode.

#### Extends

- [`WriterSyncOptions`](#writersyncoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: packages/stax-xml/src/WriterSync.ts:17

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`encoding`](#encoding-3)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: packages/stax-xml/src/WriterSync.ts:18

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`prettyPrint`](#prettyprint-1)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: packages/stax-xml/src/WriterSync.ts:19

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`indentString`](#indentstring-1)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: packages/stax-xml/src/WriterSync.ts:20

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`addEntities`](#addentities-3)

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: packages/stax-xml/src/WriterSync.ts:21

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`autoEncodeEntities`](#autoencodeentities-1)

##### namespaces?

> `optional` **namespaces?**: [`NamespaceDeclaration`](#namespacedeclaration)[]

Defined in: packages/stax-xml/src/WriterSync.ts:22

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`namespaces`](#namespaces-1)

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: packages/stax-xml/src/WriterSync.ts:33

Internal character buffer size.

###### Default Value

```ts
16384
```

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: packages/stax-xml/src/WriterSync.ts:39

Emit buffered chunks automatically when threshold is reached.

###### Default Value

```ts
true
```

##### flushOnClose?

> `optional` **flushOnClose?**: `boolean`

Defined in: packages/stax-xml/src/WriterSync.ts:45

Whether to call sink.flush() when the writer is finalized.

###### Default Value

```ts
false
```

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: packages/stax-xml/src/WriterSync.ts:52

Flush threshold (percentage or absolute char count).
If <= 1, treated as percentage of bufferSize. Otherwise absolute char count.

###### Default Value

```ts
0.8
```

***

### ParseXmlTreeOptions

Defined in: [packages/stax-xml/src/XmlObject.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L28)

Options shared by XML tree and compact object helper parsers.

#### Extended by

- [`ParseXmlObjectOptions`](#parsexmlobjectoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L29)

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-5)

Defined in: [packages/stax-xml/src/XmlObject.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L30)

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [packages/stax-xml/src/XmlObject.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L31)

##### addEntities?

> `optional` **addEntities?**: [`EntityDefinition`](#entitydefinition)[]

Defined in: [packages/stax-xml/src/XmlObject.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L32)

##### trimText?

> `optional` **trimText?**: `boolean`

Defined in: [packages/stax-xml/src/XmlObject.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L33)

##### batchSize?

> `optional` **batchSize?**: `number`

Defined in: [packages/stax-xml/src/XmlObject.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L34)

##### fallbackOnParseError?

> `optional` **fallbackOnParseError?**: `boolean`

Defined in: [packages/stax-xml/src/XmlObject.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L35)

***

### ParseXmlObjectOptions

Defined in: [packages/stax-xml/src/XmlObject.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L39)

Options for compact object projection.

#### Extends

- [`ParseXmlTreeOptions`](#parsexmltreeoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L29)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`encoding`](#encoding-5)

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-5)

Defined in: [packages/stax-xml/src/XmlObject.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L30)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`documentMode`](#documentmode-3)

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [packages/stax-xml/src/XmlObject.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L31)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`autoDecodeEntities`](#autodecodeentities-2)

##### addEntities?

> `optional` **addEntities?**: [`EntityDefinition`](#entitydefinition)[]

Defined in: [packages/stax-xml/src/XmlObject.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L32)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`addEntities`](#addentities-5)

##### trimText?

> `optional` **trimText?**: `boolean`

Defined in: [packages/stax-xml/src/XmlObject.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L33)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`trimText`](#trimtext)

##### batchSize?

> `optional` **batchSize?**: `number`

Defined in: [packages/stax-xml/src/XmlObject.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L34)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`batchSize`](#batchsize-1)

##### fallbackOnParseError?

> `optional` **fallbackOnParseError?**: `boolean`

Defined in: [packages/stax-xml/src/XmlObject.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L35)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`fallbackOnParseError`](#fallbackonparseerror-3)

##### attributePrefix?

> `optional` **attributePrefix?**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:41](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L41)

Prefix applied to XML attributes. Defaults to `@`, so `id` becomes `@id`.

##### textKey?

> `optional` **textKey?**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L43)

Key used for text in mixed-content objects. Defaults to `#text`.

##### cdataKey?

> `optional` **cdataKey?**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L45)

Key used for CDATA in compact objects. Defaults to `#cdata`.

##### alwaysArray?

> `optional` **alwaysArray?**: `boolean`

Defined in: [packages/stax-xml/src/XmlObject.ts:47](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L47)

When true, element children are always represented as arrays.

***

### XmlTreeDocument

Defined in: [packages/stax-xml/src/XmlObject.ts:51](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L51)

Document wrapper returned by `parseXmlTree()` and `parseXmlTreeSync()`.

#### Properties

##### type

> **type**: `"document"`

Defined in: [packages/stax-xml/src/XmlObject.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L52)

##### children

> **children**: [`XmlTreeNode`](#xmltreenode)[]

Defined in: [packages/stax-xml/src/XmlObject.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L53)

***

### XmlTreeElement

Defined in: [packages/stax-xml/src/XmlObject.ts:59](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L59)

Order-preserving XML element node.

#### Properties

##### type

> **type**: `"element"`

Defined in: [packages/stax-xml/src/XmlObject.ts:60](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L60)

##### name

> **name**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L61)

##### attributes

> **attributes**: [`XmlObjectRecord`](#xmlobjectrecord)\<`string`\>

Defined in: [packages/stax-xml/src/XmlObject.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L62)

##### children

> **children**: [`XmlTreeNode`](#xmltreenode)[]

Defined in: [packages/stax-xml/src/XmlObject.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L63)

***

### XmlTreeText

Defined in: [packages/stax-xml/src/XmlObject.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L67)

Text node in an order-preserving XML tree.

#### Properties

##### type

> **type**: `"text"`

Defined in: [packages/stax-xml/src/XmlObject.ts:68](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L68)

##### value

> **value**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L69)

***

### XmlTreeCdata

Defined in: [packages/stax-xml/src/XmlObject.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L73)

CDATA node in an order-preserving XML tree.

#### Properties

##### type

> **type**: `"cdata"`

Defined in: [packages/stax-xml/src/XmlObject.ts:74](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L74)

##### value

> **value**: `string`

Defined in: [packages/stax-xml/src/XmlObject.ts:75](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L75)

***

### XmlObjectArray

Defined in: [packages/stax-xml/src/XmlObject.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L82)

Array of compact object values used for repeated elements.

#### Extends

- `Array`\<[`XmlObjectValue`](#xmlobjectvalue)\>

#### Indexable

> \[`n`: `number`\]: [`XmlObjectValue`](#xmlobjectvalue)

***

### XmlObjectRecord

Defined in: [packages/stax-xml/src/XmlObject.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L85)

Null-prototype record used by tree attributes and compact object nodes.

#### Type Parameters

##### T

`T` = [`XmlObjectValue`](#xmlobjectvalue)

#### Indexable

> \[`key`: `string`\]: `T`

***

### CursorReaderOptions

Defined in: [packages/stax-xml/src/cursor/types.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L32)

Options for the sync cursor reader.

#### Extended by

- [`CursorReaderAsyncOptions`](#cursorreaderasyncoptions)

#### Properties

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [packages/stax-xml/src/cursor/types.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L34)

Whether to automatically decode XML entities. Default: true

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [packages/stax-xml/src/cursor/types.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L36)

Additional custom entities to decode

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### fallbackOnParseError?

> `optional` **fallbackOnParseError?**: `boolean`

Defined in: [packages/stax-xml/src/cursor/types.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L38)

Whether backend parse errors fall back to JavaScript.

***

### CursorReaderAsyncOptions

Defined in: [packages/stax-xml/src/cursor/types.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L45)

Options for the async cursor reader.

#### Extends

- [`CursorReaderOptions`](#cursorreaderoptions)

#### Properties

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [packages/stax-xml/src/cursor/types.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L34)

Whether to automatically decode XML entities. Default: true

###### Inherited from

[`CursorReaderOptions`](#cursorreaderoptions).[`autoDecodeEntities`](#autodecodeentities-4)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [packages/stax-xml/src/cursor/types.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L36)

Additional custom entities to decode

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`CursorReaderOptions`](#cursorreaderoptions).[`addEntities`](#addentities-7)

##### fallbackOnParseError?

> `optional` **fallbackOnParseError?**: `boolean`

Defined in: [packages/stax-xml/src/cursor/types.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L38)

Whether backend parse errors fall back to JavaScript.

###### Inherited from

[`CursorReaderOptions`](#cursorreaderoptions).[`fallbackOnParseError`](#fallbackonparseerror-5)

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [packages/stax-xml/src/cursor/types.ts:47](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L47)

Text encoding for the input stream. Default: 'utf-8'

***

### StaxXmlRuntimePlatform

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:7](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L7)

#### Properties

##### platform

> **platform**: `string`

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:8](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L8)

##### arch

> **arch**: `string`

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L9)

##### libc?

> `optional` **libc?**: [`LinuxLibc`](#linuxlibc)

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L10)

***

### StaxXmlRuntimeBackend

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L13)

#### Properties

##### kind

> **kind**: [`StaxXmlRuntimeBackendKind`](#staxxmlruntimebackendkind)

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L14)

##### packageName?

> `optional` **packageName?**: `string`

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L15)

##### module?

> `optional` **module?**: `unknown`

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L16)

##### errors

> **errors**: `object`[]

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L17)

###### packageName

> **packageName**: `string`

###### error

> **error**: `unknown`

***

### StaxXmlRuntimeCapabilities

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L20)

#### Properties

##### structuralIndexUtf8?

> `optional` **structuralIndexUtf8?**: (`input`) => `ArrayBuffer` \| `ArrayBufferView`\<`ArrayBufferLike`\>

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L21)

###### Parameters

###### input

`Uint8Array`

###### Returns

`ArrayBuffer` \| `ArrayBufferView`\<`ArrayBufferLike`\>

##### structuralIndexUtf16?

> `optional` **structuralIndexUtf16?**: (`input`) => `ArrayBuffer` \| `ArrayBufferView`\<`ArrayBufferLike`\>

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L22)

###### Parameters

###### input

`string`

###### Returns

`ArrayBuffer` \| `ArrayBufferView`\<`ArrayBufferLike`\>

##### streamingEventBatches?

> `optional` **streamingEventBatches?**: [`StaxXmlStreamingEventBatchFactory`](#staxxmlstreamingeventbatchfactory)

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L23)

##### objectRowsProjection?

> `optional` **objectRowsProjection?**: (`input`, `spec`) => `unknown`

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L24)

###### Parameters

###### input

`Uint8Array`

###### spec

`unknown`

###### Returns

`unknown`

##### itemRowsProjection?

> `optional` **itemRowsProjection?**: (`input`) => `unknown`

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L25)

###### Parameters

###### input

`Uint8Array`

###### Returns

`unknown`

***

### StaxXmlStreamingEventBatch

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L30)

#### Properties

##### buffer

> **buffer**: `ArrayBuffer` \| `ArrayBufferView`\<`ArrayBufferLike`\>

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L31)

##### table

> **table**: `ArrayBuffer` \| `ArrayBufferView`\<`ArrayBufferLike`\>

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L32)

***

### StaxXmlStreamingEventBatchParser

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L35)

#### Methods

##### pushChunk()

> **pushChunk**(`chunk`, `isFinal`): [`StaxXmlStreamingEventBatch`](#staxxmlstreamingeventbatch)

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L36)

###### Parameters

###### chunk

`Uint8Array`

###### isFinal

`boolean`

###### Returns

[`StaxXmlStreamingEventBatch`](#staxxmlstreamingeventbatch)

***

### StaxXmlRuntime

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L39)

#### Properties

##### initialized

> **initialized**: `boolean`

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:40](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L40)

##### backend

> **backend**: [`StaxXmlRuntimeBackend`](#staxxmlruntimebackend)

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:41](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L41)

##### capabilities

> **capabilities**: [`StaxXmlRuntimeCapabilities`](#staxxmlruntimecapabilities)

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:42](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L42)

***

### StaxXmlRuntimeResolverOptions

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:47](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L47)

#### Properties

##### backend?

> `optional` **backend?**: [`StaxXmlRuntimeBackendPreference`](#staxxmlruntimebackendpreference)

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L48)

##### fallbackOnLoadError?

> `optional` **fallbackOnLoadError?**: `boolean`

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L49)

##### platform?

> `optional` **platform?**: [`StaxXmlRuntimePlatform`](#staxxmlruntimeplatform)

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:50](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L50)

##### importPackage?

> `optional` **importPackage?**: [`OptionalPackageImporter`](#optionalpackageimporter)

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:51](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L51)

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

### IterableEventType

> **IterableEventType** = *typeof* [`IterableEventType`](#iterableeventtype)\[keyof *typeof* [`IterableEventType`](#iterableeventtype)\]

Defined in: packages/stax-xml/src/IterableReader.ts:8

***

### ByteBatch

> **ByteBatch** = readonly `Uint8Array`[]

Defined in: packages/stax-xml/src/IterableReader.ts:19

***

### XmlSyncInput

> **XmlSyncInput** = `string` \| `Uint8Array` \| `Iterable`\<`Uint8Array`\>

Defined in: [packages/stax-xml/src/XmlObject.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L22)

XML inputs that can be parsed without crossing an async boundary.

***

### XmlAsyncInput

> **XmlAsyncInput** = [`XmlSyncInput`](#xmlsyncinput) \| `AsyncIterable`\<`Uint8Array`\> \| `ReadableStream`\<`Uint8Array`\>

Defined in: [packages/stax-xml/src/XmlObject.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L25)

XML inputs accepted by the convenience tree/object helpers.

***

### XmlTreeNode

> **XmlTreeNode** = [`XmlTreeElement`](#xmltreeelement) \| [`XmlTreeText`](#xmltreetext) \| [`XmlTreeCdata`](#xmltreecdata)

Defined in: [packages/stax-xml/src/XmlObject.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L56)

***

### XmlObjectValue

> **XmlObjectValue** = `string` \| [`XmlObjectRecord`](#xmlobjectrecord) \| [`XmlObjectArray`](#xmlobjectarray)

Defined in: [packages/stax-xml/src/XmlObject.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L79)

Value stored in the compact object projection.

***

### CursorEventType

> **CursorEventType** = *typeof* [`CursorEventType`](#cursoreventtype)\[keyof *typeof* [`CursorEventType`](#cursoreventtype)\]

Defined in: [packages/stax-xml/src/cursor/types.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L9)

Cursor event type constants as numeric SMI values.

Using small integers (0-6) ensures V8 treats these as Smi (Small Integer),
which avoids write barrier overhead when updating mutable cursor state.

***

### StaxXmlRuntimeBackendPreference

> **StaxXmlRuntimeBackendPreference** = `"auto"` \| `"native"` \| `"wasm"` \| `"js"`

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:3](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L3)

***

### StaxXmlRuntimeBackendKind

> **StaxXmlRuntimeBackendKind** = `"native"` \| `"wasm"` \| `"js"`

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:4](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L4)

***

### LinuxLibc

> **LinuxLibc** = `"gnu"` \| `"musl"`

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:5](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L5)

***

### StaxXmlStreamingEventBatchFactory

> **StaxXmlStreamingEventBatchFactory** = (`options?`) => [`StaxXmlStreamingEventBatchParser`](#staxxmlstreamingeventbatchparser)

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L28)

#### Parameters

##### options?

`unknown`

#### Returns

[`StaxXmlStreamingEventBatchParser`](#staxxmlstreamingeventbatchparser)

***

### OptionalPackageImporter

> **OptionalPackageImporter** = (`packageName`) => `Promise`\<`unknown`\>

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L45)

#### Parameters

##### packageName

`string`

#### Returns

`Promise`\<`unknown`\>

***

### InitStaxXmlOptions

> **InitStaxXmlOptions** = [`StaxXmlRuntimeResolverOptions`](#staxxmlruntimeresolveroptions)

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:54](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L54)

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

### IterableEventType

> `const` **IterableEventType**: `object`

Defined in: packages/stax-xml/src/IterableReader.ts:8

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

Defined in: [packages/stax-xml/src/cursor/types.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/cursor/types.ts#L9)

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

Defined in: packages/stax-xml/src/EventReader.ts:141

#### Parameters

##### xmlStream

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### options?

[`EventReaderOptions`](#eventreaderoptions) = `{}`

#### Returns

[`EventReader`](#eventreader)

***

### toByteBatches()

> **toByteBatches**(`source`, `options?`): `Iterable`\<[`ByteBatch`](#bytebatch)\>

Defined in: packages/stax-xml/src/IterableReader.ts:63

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

Defined in: packages/stax-xml/src/IterableReader.ts:83

#### Parameters

##### source

`AsyncIterable`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### options?

[`ByteBatchOptions`](#bytebatchoptions) = `{}`

#### Returns

`AsyncIterable`\<[`ByteBatch`](#bytebatch)\>

***

### parseXmlTreeSync()

> **parseXmlTreeSync**(`input`, `options?`): [`XmlTreeDocument`](#xmltreedocument)

Defined in: [packages/stax-xml/src/XmlObject.ts:95](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L95)

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

Defined in: [packages/stax-xml/src/XmlObject.ts:100](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L100)

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

Defined in: [packages/stax-xml/src/XmlObject.ts:108](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L108)

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

Defined in: [packages/stax-xml/src/XmlObject.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L116)

Parse XML into a compact JavaScript object.

#### Parameters

##### input

[`XmlAsyncInput`](#xmlasyncinput)

##### options?

[`ParseXmlObjectOptions`](#parsexmlobjectoptions) = `{}`

#### Returns

`Promise`\<[`XmlObjectRecord`](#xmlobjectrecord)\<[`XmlObjectValue`](#xmlobjectvalue)\>\>

***

### initStaxXml()

> **initStaxXml**(`options?`): `Promise`\<[`StaxXmlRuntime`](#staxxmlruntime)\>

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:143](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L143)

#### Parameters

##### options?

[`StaxXmlRuntimeResolverOptions`](#staxxmlruntimeresolveroptions) = `{}`

#### Returns

`Promise`\<[`StaxXmlRuntime`](#staxxmlruntime)\>

***

### getStaxXmlRuntime()

> **getStaxXmlRuntime**(): [`StaxXmlRuntime`](#staxxmlruntime)

Defined in: [packages/stax-xml/src/runtime/native-backend.ts:163](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/runtime/native-backend.ts#L163)

#### Returns

[`StaxXmlRuntime`](#staxxmlruntime)

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
