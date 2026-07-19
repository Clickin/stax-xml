---
title: stax-xml
description: API reference for stax-xml
slug: v1.1.0/api/main
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

Defined in: [async/StreamReader.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L31)

Asynchronous, forward-only XML reader backed by a reusable token cursor.
Call `next()` before accessing the current token through the accessor methods.

#### Constructors

##### Constructor

> **new StreamReader**(`source`, `options?`): [`StreamReader`](#streamreader)

Defined in: [async/StreamReader.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L39)

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

Defined in: [async/StreamReader.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L55)

Advance to the next token, or return `null` at end of input.

###### Returns

`Promise`\<[`XmlEventType`](#xmleventtype-1) \| `null`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [async/StreamReader.ts:59](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L59)

Stop parsing and close the underlying input iterator.

###### Returns

`Promise`\<`void`\>

##### eventType()

> **eventType**(): [`XmlEventType`](#xmleventtype-1)

Defined in: [async/StreamReader.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L63)

Return the current token type.

###### Returns

[`XmlEventType`](#xmleventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: [async/StreamReader.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L67)

Return the current element's qualified name.

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [async/StreamReader.ts:71](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L71)

Return text carried by the current text-like token.

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: [async/StreamReader.ts:75](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L75)

Return the current element's local name.

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string`

Defined in: [async/StreamReader.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L79)

Return the current element's namespace prefix, or an empty string.

###### Returns

`string`

##### namespaceURI()

> **namespaceURI**(): `string`

Defined in: [async/StreamReader.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L83)

Return the namespace URI resolved for the current element.

###### Returns

`string`

##### attributeCount()

> **attributeCount**(): `number`

Defined in: [async/StreamReader.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L87)

Return the number of attributes on the current start element.

###### Returns

`number`

##### attributeName()

> **attributeName**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:91](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L91)

Return an attribute's qualified name by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeLocalName()

> **attributeLocalName**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:95](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L95)

Return an attribute's local name by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributePrefix()

> **attributePrefix**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:99](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L99)

Return an attribute's namespace prefix by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeNamespaceURI()

> **attributeNamespaceURI**(`index`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:103](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L103)

Return an attribute's namespace URI by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeValue()

> **attributeValue**(`indexOrNameOrNamespace`, `localName?`): `string` \| `undefined`

Defined in: [async/StreamReader.ts:107](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L107)

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

Defined in: [async/StreamReader.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L114)

Resolve a namespace prefix in the current element scope.

###### Parameters

###### prefix

`string`

###### Returns

`string`

***

### Writer

Defined in: [async/Writer.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L31)

Asynchronous I/O wrapper for the shared WriterCore serializer.

#### Constructors

##### Constructor

> **new Writer**(`output`, `options?`): [`Writer`](#writer)

Defined in: [async/Writer.ts:44](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L44)

###### Parameters

###### output

[`AsyncTextSink`](#asynctextsink) \| `WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

[`WriterOptions`](#writeroptions) = `{}`

###### Returns

[`Writer`](#writer)

#### Methods

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`, `standalone?`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L87)

Write an XML declaration.

###### Parameters

###### version?

`"1.0"` = `"1.0"`

###### encoding?

`string`

###### standalone?

`boolean`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:98](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L98)

Open an element.

###### Parameters

###### localName

`string`

###### options?

[`WriteElementOptions`](#writeelementoptions)

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeEndElement()

> **writeEndElement**(): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:106](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L106)

Close the current element.

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCharacters()

> **writeCharacters**(`text`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:111](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L111)

Write escaped character data.

###### Parameters

###### text

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeCData()

> **writeCData**(`cdata`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L116)

Write a CDATA section.

###### Parameters

###### cdata

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeAttribute()

> **writeAttribute**(`localName`, `value`, `prefix?`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:121](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L121)

Add an attribute to the open start tag.

###### Parameters

###### localName

`string`

###### value

`string`

###### prefix?

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeNamespace()

> **writeNamespace**(`prefix`, `uri`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L130)

Add a namespace declaration to the open start tag.

###### Parameters

###### prefix

`string`

###### uri

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeComment()

> **writeComment**(`comment`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L135)

Write an XML comment.

###### Parameters

###### comment

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:140](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L140)

Write a processing instruction.

###### Parameters

###### target

`string`

###### data?

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeDTD()

> **writeDTD**(`value`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:148](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L148)

Write a document type declaration.

###### Parameters

###### value

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeEvent()

> **writeEvent**(`event`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:153](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L153)

Write one standard materialized XML event.

###### Parameters

###### event

[`AnyXmlEvent`](#anyxmlevent)

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeRaw()

> **writeRaw**(`xml`): `Promise`\<[`Writer`](#writer)\>

Defined in: [async/Writer.ts:159](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L159)

Write trusted XML text without escaping.

###### Parameters

###### xml

`string`

###### Returns

`Promise`\<[`Writer`](#writer)\>

##### writeEndDocument()

> **writeEndDocument**(): `Promise`\<`void`\>

Defined in: [async/Writer.ts:165](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L165)

Finish the XML document and close the output.

###### Returns

`Promise`\<`void`\>

##### close()

> **close**(): `Promise`\<`void`\>

Defined in: [async/Writer.ts:180](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L180)

Close the writer and its output.

###### Returns

`Promise`\<`void`\>

##### flush()

> **flush**(): `Promise`\<`void`\>

Defined in: [async/Writer.ts:184](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L184)

Flush buffered output.

###### Returns

`Promise`\<`void`\>

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

Defined in: [sync/StreamReaderSync.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L28)

Synchronous current-token reader. Strings are scanned directly without
encoding; byte inputs are decoded in fatal mode with the configured encoding.

#### Constructors

##### Constructor

> **new StreamReaderSync**(`input`, `options?`): [`StreamReaderSync`](#streamreadersync)

Defined in: [sync/StreamReaderSync.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L34)

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

Defined in: [sync/StreamReaderSync.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L63)

Advance to the next token, or return `null` at end of input.

###### Returns

[`XmlEventType`](#xmleventtype-1) \| `null`

##### close()

> **close**(): `void`

Defined in: [sync/StreamReaderSync.ts:89](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L89)

Stop parsing and release the underlying input iterator.

###### Returns

`void`

##### eventType()

> **eventType**(): [`XmlEventType`](#xmleventtype-1)

Defined in: [sync/StreamReaderSync.ts:98](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L98)

Return the current token type.

###### Returns

[`XmlEventType`](#xmleventtype-1)

##### name()

> **name**(): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:102](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L102)

Return the current element's qualified name.

###### Returns

`string` \| `undefined`

##### text()

> **text**(): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:106](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L106)

Return text carried by the current text-like token.

###### Returns

`string` \| `undefined`

##### localName()

> **localName**(): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:110](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L110)

Return the current element's local name.

###### Returns

`string` \| `undefined`

##### prefix()

> **prefix**(): `string`

Defined in: [sync/StreamReaderSync.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L114)

Return the current element's namespace prefix, or an empty string.

###### Returns

`string`

##### namespaceURI()

> **namespaceURI**(): `string`

Defined in: [sync/StreamReaderSync.ts:118](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L118)

Return the namespace URI resolved for the current element.

###### Returns

`string`

##### attributeCount()

> **attributeCount**(): `number`

Defined in: [sync/StreamReaderSync.ts:122](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L122)

Return the number of attributes on the current start element.

###### Returns

`number`

##### attributeName()

> **attributeName**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L126)

Return an attribute's qualified name by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeLocalName()

> **attributeLocalName**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L130)

Return an attribute's local name by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributePrefix()

> **attributePrefix**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:134](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L134)

Return an attribute's namespace prefix by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeNamespaceURI()

> **attributeNamespaceURI**(`index`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:138](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L138)

Return an attribute's namespace URI by zero-based index.

###### Parameters

###### index

`number`

###### Returns

`string` \| `undefined`

##### attributeValue()

> **attributeValue**(`indexOrNameOrNamespace`, `localName?`): `string` \| `undefined`

Defined in: [sync/StreamReaderSync.ts:142](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L142)

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

Defined in: [sync/StreamReaderSync.ts:151](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L151)

Resolve a namespace prefix in the current element scope.

###### Parameters

###### prefix

`string`

###### Returns

`string`

***

### WriterSync

Defined in: [sync/WriterSync.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L35)

String-based synchronous XML writer.

#### Extended by

- [`WriterSyncSink`](#writersyncsink)

#### Constructors

##### Constructor

> **new WriterSync**(`options?`, `encoding?`): [`WriterSync`](#writersync)

Defined in: [sync/WriterSync.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L39)

###### Parameters

###### options?

[`WriterSyncOptions`](#writersyncoptions) = `{}`

###### encoding?

`string` = `...`

###### Returns

[`WriterSync`](#writersync)

#### Methods

##### getXmlString()

> **getXmlString**(): `string`

Defined in: [sync/WriterSync.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L48)

Return XML accumulated by this string writer.

###### Returns

`string`

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`, `standalone?`): `this`

Defined in: [sync/WriterSync.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L56)

Write an XML declaration.

###### Parameters

###### version?

`"1.0"` = `"1.0"`

###### encoding?

`string`

###### standalone?

`boolean`

###### Returns

`this`

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: [sync/WriterSync.ts:65](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L65)

Finish the XML document.

###### Returns

`void`

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: [sync/WriterSync.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L69)

Open an element.

###### Parameters

###### localName

`string`

###### options?

[`WriteElementOptions`](#writeelementoptions)

###### Returns

`this`

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [sync/WriterSync.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L77)

Close the current element.

###### Returns

`this`

##### writeCharacters()

> **writeCharacters**(`text`): `this`

Defined in: [sync/WriterSync.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L82)

Write escaped character data.

###### Parameters

###### text

`string`

###### Returns

`this`

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [sync/WriterSync.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L87)

Write a CDATA section.

###### Parameters

###### cdata

`string`

###### Returns

`this`

##### writeAttribute()

> **writeAttribute**(`localName`, `value`, `prefix?`): `this`

Defined in: [sync/WriterSync.ts:92](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L92)

Add an attribute to the open start tag.

###### Parameters

###### localName

`string`

###### value

`string`

###### prefix?

`string`

###### Returns

`this`

##### writeNamespace()

> **writeNamespace**(`prefix`, `uri`): `this`

Defined in: [sync/WriterSync.ts:101](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L101)

Add a namespace declaration to the open start tag.

###### Parameters

###### prefix

`string`

###### uri

`string`

###### Returns

`this`

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [sync/WriterSync.ts:106](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L106)

Write an XML comment.

###### Parameters

###### comment

`string`

###### Returns

`this`

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [sync/WriterSync.ts:111](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L111)

Write a processing instruction.

###### Parameters

###### target

`string`

###### data?

`string`

###### Returns

`this`

##### writeDTD()

> **writeDTD**(`value`): `this`

Defined in: [sync/WriterSync.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L116)

Write a document type declaration.

###### Parameters

###### value

`string`

###### Returns

`this`

##### writeEvent()

> **writeEvent**(`event`): `this`

Defined in: [sync/WriterSync.ts:121](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L121)

Write one standard materialized XML event.

###### Parameters

###### event

[`AnyXmlEvent`](#anyxmlevent)

###### Returns

`this`

##### writeRaw()

> **writeRaw**(`xml`): `this`

Defined in: [sync/WriterSync.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L127)

Write trusted XML text without escaping.

###### Parameters

###### xml

`string`

###### Returns

`this`

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [sync/WriterSync.ts:132](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L132)

Enable or disable pretty printing.

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [sync/WriterSync.ts:137](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L137)

Set the indentation unit used by pretty printing.

###### Parameters

###### indentString

`string`

###### Returns

`this`

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [sync/WriterSync.ts:142](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L142)

Return whether pretty printing is enabled.

###### Returns

`boolean`

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [sync/WriterSync.ts:146](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L146)

Return the current indentation unit.

###### Returns

`string`

***

### WriterSyncSink

Defined in: [sync/WriterSync.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L152)

Sink-based sync writer. I/O and flushing live here, outside WriterCore.

#### Extends

- [`WriterSync`](#writersync)

#### Constructors

##### Constructor

> **new WriterSyncSink**(`sink`, `options?`): [`WriterSyncSink`](#writersyncsink)

Defined in: [sync/WriterSync.ts:159](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L159)

###### Parameters

###### sink

[`SyncTextSink`](#synctextsink)

###### options?

[`WriterSyncSinkOptions`](#writersyncsinkoptions) = `{}`

###### Returns

[`WriterSyncSink`](#writersyncsink)

###### Overrides

[`WriterSync`](#writersync).[`constructor`](#constructor-5)

#### Methods

##### getXmlString()

> **getXmlString**(): `string`

Defined in: [sync/WriterSync.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L48)

Return XML accumulated by this string writer.

###### Returns

`string`

###### Inherited from

[`WriterSync`](#writersync).[`getXmlString`](#getxmlstring)

##### writeStartDocument()

> **writeStartDocument**(`version?`, `encoding?`, `standalone?`): `this`

Defined in: [sync/WriterSync.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L56)

Write an XML declaration.

###### Parameters

###### version?

`"1.0"` = `"1.0"`

###### encoding?

`string`

###### standalone?

`boolean`

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`writeStartDocument`](#writestartdocument-1)

##### writeStartElement()

> **writeStartElement**(`localName`, `options?`): `this`

Defined in: [sync/WriterSync.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L69)

Open an element.

###### Parameters

###### localName

`string`

###### options?

[`WriteElementOptions`](#writeelementoptions)

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`writeStartElement`](#writestartelement-1)

##### writeEndElement()

> **writeEndElement**(): `this`

Defined in: [sync/WriterSync.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L77)

Close the current element.

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`writeEndElement`](#writeendelement-1)

##### writeCharacters()

> **writeCharacters**(`text`): `this`

Defined in: [sync/WriterSync.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L82)

Write escaped character data.

###### Parameters

###### text

`string`

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`writeCharacters`](#writecharacters-1)

##### writeCData()

> **writeCData**(`cdata`): `this`

Defined in: [sync/WriterSync.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L87)

Write a CDATA section.

###### Parameters

###### cdata

`string`

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`writeCData`](#writecdata-1)

##### writeAttribute()

> **writeAttribute**(`localName`, `value`, `prefix?`): `this`

Defined in: [sync/WriterSync.ts:92](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L92)

Add an attribute to the open start tag.

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

[`WriterSync`](#writersync).[`writeAttribute`](#writeattribute-1)

##### writeNamespace()

> **writeNamespace**(`prefix`, `uri`): `this`

Defined in: [sync/WriterSync.ts:101](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L101)

Add a namespace declaration to the open start tag.

###### Parameters

###### prefix

`string`

###### uri

`string`

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`writeNamespace`](#writenamespace-1)

##### writeComment()

> **writeComment**(`comment`): `this`

Defined in: [sync/WriterSync.ts:106](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L106)

Write an XML comment.

###### Parameters

###### comment

`string`

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`writeComment`](#writecomment-1)

##### writeProcessingInstruction()

> **writeProcessingInstruction**(`target`, `data?`): `this`

Defined in: [sync/WriterSync.ts:111](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L111)

Write a processing instruction.

###### Parameters

###### target

`string`

###### data?

`string`

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`writeProcessingInstruction`](#writeprocessinginstruction-1)

##### writeDTD()

> **writeDTD**(`value`): `this`

Defined in: [sync/WriterSync.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L116)

Write a document type declaration.

###### Parameters

###### value

`string`

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`writeDTD`](#writedtd-1)

##### writeEvent()

> **writeEvent**(`event`): `this`

Defined in: [sync/WriterSync.ts:121](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L121)

Write one standard materialized XML event.

###### Parameters

###### event

[`AnyXmlEvent`](#anyxmlevent)

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`writeEvent`](#writeevent-1)

##### writeRaw()

> **writeRaw**(`xml`): `this`

Defined in: [sync/WriterSync.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L127)

Write trusted XML text without escaping.

###### Parameters

###### xml

`string`

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`writeRaw`](#writeraw-1)

##### setPrettyPrint()

> **setPrettyPrint**(`enabled`): `this`

Defined in: [sync/WriterSync.ts:132](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L132)

Enable or disable pretty printing.

###### Parameters

###### enabled

`boolean`

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`setPrettyPrint`](#setprettyprint)

##### setIndentString()

> **setIndentString**(`indentString`): `this`

Defined in: [sync/WriterSync.ts:137](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L137)

Set the indentation unit used by pretty printing.

###### Parameters

###### indentString

`string`

###### Returns

`this`

###### Inherited from

[`WriterSync`](#writersync).[`setIndentString`](#setindentstring)

##### isPrettyPrintEnabled()

> **isPrettyPrintEnabled**(): `boolean`

Defined in: [sync/WriterSync.ts:142](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L142)

Return whether pretty printing is enabled.

###### Returns

`boolean`

###### Inherited from

[`WriterSync`](#writersync).[`isPrettyPrintEnabled`](#isprettyprintenabled)

##### getIndentString()

> **getIndentString**(): `string`

Defined in: [sync/WriterSync.ts:146](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L146)

Return the current indentation unit.

###### Returns

`string`

###### Inherited from

[`WriterSync`](#writersync).[`getIndentString`](#getindentstring)

##### writeEndDocument()

> **writeEndDocument**(): `void`

Defined in: [sync/WriterSync.ts:200](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L200)

Finish the document and flush serialized text to the sink.

###### Returns

`void`

###### Overrides

[`WriterSync`](#writersync).[`writeEndDocument`](#writeenddocument-1)

##### flush()

> **flush**(): `void`

Defined in: [sync/WriterSync.ts:206](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L206)

Flush buffered text to the sink.

###### Returns

`void`

##### close()

> **close**(): `void`

Defined in: [sync/WriterSync.ts:217](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L217)

Finalize the document and close the sink.

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

Defined in: [async/StreamReader.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L16)

###### Inherited from

[`StreamReaderOptions`](#streamreaderoptions).[`documentMode`](#documentmode-1)

##### namespaceAware?

> `optional` **namespaceAware?**: `boolean`

Defined in: [async/StreamReader.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L18)

Resolve namespaces while retaining xmlns declarations in start-event attributes.

###### Default Value

```ts
true
```

###### Inherited from

[`StreamReaderOptions`](#streamreaderoptions).[`namespaceAware`](#namespaceaware-1)

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [async/StreamReader.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L20)

Decode predefined, numeric, and configured custom entities.

###### Default Value

```ts
true
```

###### Inherited from

[`StreamReaderOptions`](#streamreaderoptions).[`autoDecodeEntities`](#autodecodeentities-1)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [async/StreamReader.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L22)

Trusted internal entity replacements available without parsing a DTD.

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`StreamReaderOptions`](#streamreaderoptions).[`addEntities`](#addentities-1)

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [async/StreamReader.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L24)

TextDecoder encoding label for byte input.

###### Default Value

```ts
'utf-8'
```

###### Inherited from

[`StreamReaderOptions`](#streamreaderoptions).[`encoding`](#encoding-1)

***

### StreamReaderOptions

Defined in: [async/StreamReader.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L15)

Options for asynchronous current-token parsing.

#### Extended by

- [`EventReaderOptions`](#eventreaderoptions)

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [async/StreamReader.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L16)

##### namespaceAware?

> `optional` **namespaceAware?**: `boolean`

Defined in: [async/StreamReader.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L18)

Resolve namespaces while retaining xmlns declarations in start-event attributes.

###### Default Value

```ts
true
```

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [async/StreamReader.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L20)

Decode predefined, numeric, and configured custom entities.

###### Default Value

```ts
true
```

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [async/StreamReader.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L22)

Trusted internal entity replacements available without parsing a DTD.

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [async/StreamReader.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L24)

TextDecoder encoding label for byte input.

###### Default Value

```ts
'utf-8'
```

***

### WriterOptions

Defined in: [async/Writer.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L9)

Options shared by the asynchronous XML writer and its serializer core.

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [async/Writer.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L10)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [async/Writer.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L11)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [async/Writer.ts:12](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L12)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [async/Writer.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L13)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [async/Writer.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L14)

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [async/Writer.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L15)

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [async/Writer.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L16)

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [async/Writer.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L17)

***

### AsyncTextSink

Defined in: [async/Writer.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L20)

Text sink for external streaming encoders.

#### Properties

##### encoding

> `readonly` **encoding**: `string`

Defined in: [async/Writer.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L21)

#### Methods

##### write()

> **write**(`chunk`): `void` \| `Promise`\<`void`\>

Defined in: [async/Writer.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L23)

Write a serialized XML text chunk.

###### Parameters

###### chunk

`string`

###### Returns

`void` \| `Promise`\<`void`\>

##### flush()?

> `optional` **flush**(): `void` \| `Promise`\<`void`\>

Defined in: [async/Writer.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L25)

Flush buffered text when supported.

###### Returns

`void` \| `Promise`\<`void`\>

##### close()?

> `optional` **close**(): `void` \| `Promise`\<`void`\>

Defined in: [async/Writer.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/Writer.ts#L27)

Close the sink when supported.

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

##### version?

> `optional` **version?**: `"1.0"`

Defined in: [core/types.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L28)

Present only when the source contained an XML declaration.

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [core/types.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L29)

##### standalone?

> `optional` **standalone?**: `boolean`

Defined in: [core/types.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L30)

***

### EndDocumentEvent

Defined in: [core/types.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L38)

Event fired when the document ends parsing

#### Properties

##### type

> **type**: `"END_DOCUMENT"`

Defined in: [core/types.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L39)

***

### StartElementEvent

Defined in: [core/types.ts:47](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L47)

Event fired when an XML element starts

#### Properties

##### type

> **type**: `"START_ELEMENT"`

Defined in: [core/types.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L48)

##### name

> **name**: `string`

Defined in: [core/types.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L49)

##### localName

> **localName**: `string`

Defined in: [core/types.ts:50](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L50)

##### prefix

> **prefix**: `string`

Defined in: [core/types.ts:51](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L51)

##### namespaceURI

> **namespaceURI**: `string`

Defined in: [core/types.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L52)

##### attributes?

> `optional` **attributes?**: [`EventAttributes`](#eventattributes)

Defined in: [core/types.ts:54](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L54)

Attributes in source order, or undefined when the element has none.

##### selfClosing

> **selfClosing**: `boolean`

Defined in: [core/types.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L56)

Whether the source used an empty-element tag (`<element/>`).

***

### EventAttribute

Defined in: [core/types.ts:60](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L60)

Materialized attribute attached to a start-element event.

#### Properties

##### name

> **name**: `string`

Defined in: [core/types.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L61)

##### localName

> **localName**: `string`

Defined in: [core/types.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L62)

##### prefix

> **prefix**: `string`

Defined in: [core/types.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L63)

##### namespaceURI

> **namespaceURI**: `string`

Defined in: [core/types.ts:64](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L64)

##### value

> **value**: `string`

Defined in: [core/types.ts:65](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L65)

***

### EventAttributes

Defined in: [core/types.ts:75](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L75)

Attribute lookup table keyed by qualified XML name.

#### Remarks

Iteration follows source order. `JSON.stringify()` emits the same object
shape as a record while reserved JavaScript property names remain safe.

#### Extends

- `ReadonlyMap`\<`string`, [`EventAttribute`](#eventattribute)\>

#### Methods

##### toJSON()

> **toJSON**(): `Record`\<`string`, [`EventAttribute`](#eventattribute)\>

Defined in: [core/types.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L77)

Return a qualified-name record for JSON serialization.

###### Returns

`Record`\<`string`, [`EventAttribute`](#eventattribute)\>

***

### EndElementEvent

Defined in: [core/types.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L81)

Event emitted when an XML element ends.

#### Properties

##### type

> **type**: `"END_ELEMENT"`

Defined in: [core/types.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L82)

##### name

> **name**: `string`

Defined in: [core/types.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L83)

##### localName

> **localName**: `string`

Defined in: [core/types.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L84)

##### prefix

> **prefix**: `string`

Defined in: [core/types.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L85)

##### namespaceURI

> **namespaceURI**: `string`

Defined in: [core/types.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L86)

***

### CharactersEvent

Defined in: [core/types.ts:90](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L90)

Event containing ordinary character data.

#### Properties

##### type

> **type**: `"CHARACTERS"`

Defined in: [core/types.ts:91](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L91)

##### value

> **value**: `string`

Defined in: [core/types.ts:92](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L92)

***

### CdataEvent

Defined in: [core/types.ts:96](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L96)

Event containing CDATA content.

#### Properties

##### type

> **type**: `"CDATA"`

Defined in: [core/types.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L97)

##### value

> **value**: `string`

Defined in: [core/types.ts:98](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L98)

***

### CommentEvent

Defined in: [core/types.ts:102](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L102)

Event containing an XML comment.

#### Properties

##### type

> **type**: `"COMMENT"`

Defined in: [core/types.ts:103](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L103)

##### value

> **value**: `string`

Defined in: [core/types.ts:104](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L104)

***

### ProcessingInstructionEvent

Defined in: [core/types.ts:107](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L107)

Event containing an XML processing instruction.

#### Properties

##### type

> **type**: `"PROCESSING_INSTRUCTION"`

Defined in: [core/types.ts:108](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L108)

##### target

> **target**: `string`

Defined in: [core/types.ts:109](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L109)

##### data

> **data**: `string`

Defined in: [core/types.ts:110](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L110)

***

### DtdEvent

Defined in: [core/types.ts:113](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L113)

Event containing a document type declaration.

#### Properties

##### type

> **type**: `"DTD"`

Defined in: [core/types.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L114)

##### value

> **value**: `string`

Defined in: [core/types.ts:115](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L115)

***

### AttributeInfo

Defined in: [core/types.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L135)

Attribute information interface

#### Properties

##### value

> **value**: `string`

Defined in: [core/types.ts:136](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L136)

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [core/types.ts:137](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L137)

##### uri?

> `optional` **uri?**: `string`

Defined in: [core/types.ts:138](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L138)

***

### WriteElementOptions

Defined in: [core/types.ts:207](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L207)

Element writing options interface (for Writer)

#### Properties

##### prefix?

> `optional` **prefix?**: `string`

Defined in: [core/types.ts:208](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L208)

##### uri?

> `optional` **uri?**: `string`

Defined in: [core/types.ts:209](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L209)

##### attributes?

> `optional` **attributes?**: `Record`\<`string`, `string` \| [`AttributeInfo`](#attributeinfo)\>

Defined in: [core/types.ts:210](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L210)

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: [core/types.ts:211](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L211)

##### comment?

> `optional` **comment?**: `string`

Defined in: [core/types.ts:212](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L212)

***

### EventReaderSyncOptions

Defined in: [sync/EventReaderSync.ts:5](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/EventReaderSync.ts#L5)

Options for the synchronous materialized-event reader.

#### Extends

- [`StreamReaderSyncOptions`](#streamreadersyncoptions)

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [sync/StreamReaderSync.ts:12](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L12)

###### Inherited from

[`StreamReaderSyncOptions`](#streamreadersyncoptions).[`documentMode`](#documentmode-4)

##### namespaceAware?

> `optional` **namespaceAware?**: `boolean`

Defined in: [sync/StreamReaderSync.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L14)

Resolve namespaces while retaining xmlns declarations in start-event attributes.

###### Default Value

```ts
true
```

###### Inherited from

[`StreamReaderSyncOptions`](#streamreadersyncoptions).[`namespaceAware`](#namespaceaware-3)

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [sync/StreamReaderSync.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L16)

Decode predefined, numeric, and configured custom entities.

###### Default Value

```ts
true
```

###### Inherited from

[`StreamReaderSyncOptions`](#streamreadersyncoptions).[`autoDecodeEntities`](#autodecodeentities-3)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [sync/StreamReaderSync.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L18)

Trusted internal entity replacements available without parsing a DTD.

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`StreamReaderSyncOptions`](#streamreadersyncoptions).[`addEntities`](#addentities-4)

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [sync/StreamReaderSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L20)

TextDecoder encoding label for byte input.

###### Default Value

```ts
'utf-8'
```

###### Inherited from

[`StreamReaderSyncOptions`](#streamreadersyncoptions).[`encoding`](#encoding-6)

***

### StreamReaderSyncOptions

Defined in: [sync/StreamReaderSync.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L11)

Options for synchronous current-token parsing.

#### Extended by

- [`EventReaderSyncOptions`](#eventreadersyncoptions)

#### Properties

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [sync/StreamReaderSync.ts:12](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L12)

##### namespaceAware?

> `optional` **namespaceAware?**: `boolean`

Defined in: [sync/StreamReaderSync.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L14)

Resolve namespaces while retaining xmlns declarations in start-event attributes.

###### Default Value

```ts
true
```

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [sync/StreamReaderSync.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L16)

Decode predefined, numeric, and configured custom entities.

###### Default Value

```ts
true
```

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [sync/StreamReaderSync.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L18)

Trusted internal entity replacements available without parsing a DTD.

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [sync/StreamReaderSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L20)

TextDecoder encoding label for byte input.

###### Default Value

```ts
'utf-8'
```

***

### SyncTextSink

Defined in: [sync/WriterSync.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L9)

Sink interface for custom sync targets.

#### Properties

##### encoding?

> `readonly` `optional` **encoding?**: `string`

Defined in: [sync/WriterSync.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L10)

#### Methods

##### write()

> **write**(`chunk`): `void`

Defined in: [sync/WriterSync.ts:12](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L12)

Write a serialized XML text chunk.

###### Parameters

###### chunk

`string`

###### Returns

`void`

##### flush()?

> `optional` **flush**(): `void`

Defined in: [sync/WriterSync.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L14)

Flush buffered text when supported.

###### Returns

`void`

##### close()?

> `optional` **close**(): `void`

Defined in: [sync/WriterSync.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L16)

Close the sink when supported.

###### Returns

`void`

***

### WriterSyncOptions

Defined in: [sync/WriterSync.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L19)

Options for string-based synchronous writing.

#### Extended by

- [`WriterSyncSinkOptions`](#writersyncsinkoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [sync/WriterSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L20)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [sync/WriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L21)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [sync/WriterSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L22)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [sync/WriterSync.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L23)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [sync/WriterSync.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L24)

***

### WriterSyncSinkOptions

Defined in: [sync/WriterSync.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L27)

Options for incremental synchronous sink writing.

#### Extends

- [`WriterSyncOptions`](#writersyncoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [sync/WriterSync.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L20)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`encoding`](#encoding-8)

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [sync/WriterSync.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L21)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`prettyPrint`](#prettyprint-1)

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [sync/WriterSync.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L22)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`indentString`](#indentstring-1)

##### addEntities?

> `optional` **addEntities?**: `object`[]

Defined in: [sync/WriterSync.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L23)

###### entity

> **entity**: `string`

###### value

> **value**: `string`

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`addEntities`](#addentities-5)

##### autoEncodeEntities?

> `optional` **autoEncodeEntities?**: `boolean`

Defined in: [sync/WriterSync.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L24)

###### Inherited from

[`WriterSyncOptions`](#writersyncoptions).[`autoEncodeEntities`](#autoencodeentities-1)

##### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [sync/WriterSync.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L28)

##### enableAutoFlush?

> `optional` **enableAutoFlush?**: `boolean`

Defined in: [sync/WriterSync.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L29)

##### flushOnClose?

> `optional` **flushOnClose?**: `boolean`

Defined in: [sync/WriterSync.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L30)

##### flushThreshold?

> `optional` **flushThreshold?**: `number`

Defined in: [sync/WriterSync.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/WriterSync.ts#L31)

## Type Aliases

### StreamReaderSource

> **StreamReaderSource** = `AsyncIterable`\<`Uint8Array`\> \| `ReadableStream`\<`Uint8Array`\>

Defined in: [async/StreamReader.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/async/StreamReader.ts#L11)

Byte-stream sources accepted by `StreamReader`.

***

### XmlEventType

> **XmlEventType** = *typeof* [`XmlEventType`](#xmleventtype)\[keyof *typeof* [`XmlEventType`](#xmleventtype)\]

Defined in: [core/types.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L6)

Enumeration of XML stream event types used by the StAX parser

***

### AnyXmlEvent

> **AnyXmlEvent** = [`StartDocumentEvent`](#startdocumentevent) \| [`EndDocumentEvent`](#enddocumentevent) \| [`StartElementEvent`](#startelementevent) \| [`EndElementEvent`](#endelementevent) \| [`CharactersEvent`](#charactersevent) \| [`CdataEvent`](#cdataevent) \| [`CommentEvent`](#commentevent) \| [`ProcessingInstructionEvent`](#processinginstructionevent) \| [`DtdEvent`](#dtdevent)

Defined in: [core/types.ts:121](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L121)

Discriminated Union type for developer use

***

### DocumentMode

> **DocumentMode** = `"fragment"` \| `"document"`

Defined in: [core/types.ts:226](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L226)

XML document conformance mode.

***

### StreamReaderSyncInput

> **StreamReaderSyncInput** = `string` \| `Uint8Array` \| `Iterable`\<`Uint8Array`\>

Defined in: [sync/StreamReaderSync.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/sync/StreamReaderSync.ts#L9)

Inputs accepted by `StreamReaderSync`.

## Variables

### XmlEventType

> `const` **XmlEventType**: `object`

Defined in: [core/types.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L6)

Enumeration of XML stream event types used by the StAX parser

#### Type Declaration

##### START\_DOCUMENT

> `readonly` **START\_DOCUMENT**: `"START_DOCUMENT"` = `"START_DOCUMENT"`

##### END\_DOCUMENT

> `readonly` **END\_DOCUMENT**: `"END_DOCUMENT"` = `"END_DOCUMENT"`

##### START\_ELEMENT

> `readonly` **START\_ELEMENT**: `"START_ELEMENT"` = `"START_ELEMENT"`

##### END\_ELEMENT

> `readonly` **END\_ELEMENT**: `"END_ELEMENT"` = `"END_ELEMENT"`

##### CHARACTERS

> `readonly` **CHARACTERS**: `"CHARACTERS"` = `"CHARACTERS"`

##### CDATA

> `readonly` **CDATA**: `"CDATA"` = `"CDATA"`

##### COMMENT

> `readonly` **COMMENT**: `"COMMENT"` = `"COMMENT"`

##### PROCESSING\_INSTRUCTION

> `readonly` **PROCESSING\_INSTRUCTION**: `"PROCESSING_INSTRUCTION"` = `"PROCESSING_INSTRUCTION"`

##### DTD

> `readonly` **DTD**: `"DTD"` = `"DTD"`

## Functions

### isStartElement()

> **isStartElement**(`event`): `event is StartElementEvent`

Defined in: [core/types.ts:151](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L151)

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

Defined in: [core/types.ts:160](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L160)

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

Defined in: [core/types.ts:169](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L169)

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

Defined in: [core/types.ts:177](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L177)

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

Defined in: [core/types.ts:190](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L190)

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

Defined in: [core/types.ts:200](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/core/types.ts#L200)

Type guard function - Check if the event is an END_DOCUMENT event

#### Parameters

##### event

[`AnyXmlEvent`](#anyxmlevent)

XML event to check

#### Returns

`event is EndDocumentEvent`

true if the event is an END_DOCUMENT event, false otherwise
