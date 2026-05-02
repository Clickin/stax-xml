---
title: stax-xml
description: API reference for stax-xml
---

**stax-xml**

***

# stax-xml

## Classes

### ProjectionReader

Defined in: [projection/index.ts:137](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L137)

#### Constructors

##### Constructor

> **new ProjectionReader**(`options?`): [`ProjectionReader`](#projectionreader)

Defined in: [projection/index.ts:143](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L143)

###### Parameters

###### options?

[`ProjectionReaderOptions`](#projectionreaderoptions) = `{}`

###### Returns

[`ProjectionReader`](#projectionreader)

#### Methods

##### parseNodes()

> **parseNodes**(`input`, `options?`): `Promise`\<[`XmlNode`](#xmlnode)[]\>

Defined in: [projection/index.ts:145](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L145)

###### Parameters

###### input

[`XmlAsyncInput`](#xmlasyncinput)

###### options?

[`ParseXmlNodesOptions`](#parsexmlnodesoptions)

###### Returns

`Promise`\<[`XmlNode`](#xmlnode)[]\>

##### parseNodesSync()

> **parseNodesSync**(`input`, `options?`): [`XmlNode`](#xmlnode)[]

Defined in: [projection/index.ts:155](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L155)

###### Parameters

###### input

[`XmlSyncInput`](#xmlsyncinput)

###### options?

[`ParseXmlNodesOptions`](#parsexmlnodesoptions)

###### Returns

[`XmlNode`](#xmlnode)[]

##### projectObjectRows()

> **projectObjectRows**(`input`, `spec`, `options?`): `Promise`\<[`ObjectRowsProjectionResult`](#objectrowsprojectionresult)\>

Defined in: [projection/index.ts:165](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L165)

###### Parameters

###### input

`ArrayBufferView`

###### spec

[`ObjectRowsProjectionSpec`](#objectrowsprojectionspec)

###### options?

[`ProjectionReaderOptions`](#projectionreaderoptions)

###### Returns

`Promise`\<[`ObjectRowsProjectionResult`](#objectrowsprojectionresult)\>

##### projectObjectRowsSync()

> **projectObjectRowsSync**(`input`, `spec`, `options?`): [`ObjectRowsProjectionResult`](#objectrowsprojectionresult)

Defined in: [projection/index.ts:176](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L176)

###### Parameters

###### input

`ArrayBufferView`

###### spec

[`ObjectRowsProjectionSpec`](#objectrowsprojectionspec)

###### options?

[`ProjectionReaderOptions`](#projectionreaderoptions)

###### Returns

[`ObjectRowsProjectionResult`](#objectrowsprojectionresult)

##### projectItemRows()

> **projectItemRows**(`input`, `options?`): `Promise`\<[`ItemRowsProjectionResult`](#itemrowsprojectionresult)\>

Defined in: [projection/index.ts:191](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L191)

###### Parameters

###### input

`ArrayBufferView`

###### options?

[`ProjectionReaderOptions`](#projectionreaderoptions)

###### Returns

`Promise`\<[`ItemRowsProjectionResult`](#itemrowsprojectionresult)\>

##### projectItemRowsSync()

> **projectItemRowsSync**(`input`, `options?`): [`ItemRowsProjectionResult`](#itemrowsprojectionresult)

Defined in: [projection/index.ts:201](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L201)

###### Parameters

###### input

`ArrayBufferView`

###### options?

[`ProjectionReaderOptions`](#projectionreaderoptions)

###### Returns

[`ItemRowsProjectionResult`](#itemrowsprojectionresult)

##### projectObjectRecords()

> **projectObjectRecords**(`input`, `spec`, `options?`): `Promise`\<[`ObjectRecordsProjectionResult`](#objectrecordsprojectionresult)\>

Defined in: [projection/index.ts:211](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L211)

###### Parameters

###### input

`ArrayBufferView`

###### spec

[`ObjectRowsProjectionSpec`](#objectrowsprojectionspec)

###### options?

[`ProjectionReaderOptions`](#projectionreaderoptions)

###### Returns

`Promise`\<[`ObjectRecordsProjectionResult`](#objectrecordsprojectionresult)\>

##### projectObjectRecordsSync()

> **projectObjectRecordsSync**(`input`, `spec`, `options?`): [`ObjectRecordsProjectionResult`](#objectrecordsprojectionresult)

Defined in: [projection/index.ts:222](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L222)

###### Parameters

###### input

`ArrayBufferView`

###### spec

[`ObjectRowsProjectionSpec`](#objectrowsprojectionspec)

###### options?

[`ProjectionReaderOptions`](#projectionreaderoptions)

###### Returns

[`ObjectRecordsProjectionResult`](#objectrecordsprojectionresult)

## Interfaces

### EntityDefinition

Defined in: [IterableEventBackend.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/IterableEventBackend.ts#L25)

#### Properties

##### entity

> **entity**: `string`

Defined in: [IterableEventBackend.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/IterableEventBackend.ts#L26)

##### value

> **value**: `string`

Defined in: [IterableEventBackend.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/IterableEventBackend.ts#L27)

***

### ParseXmlTreeOptions

Defined in: [XmlObject.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L28)

Options shared by XML tree and compact object helper parsers.

#### Extended by

- [`ParseXmlNodesOptions`](#parsexmlnodesoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [XmlObject.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L29)

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [XmlObject.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L30)

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [XmlObject.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L31)

##### addEntities?

> `optional` **addEntities?**: [`EntityDefinition`](#entitydefinition)[]

Defined in: [XmlObject.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L32)

##### trimText?

> `optional` **trimText?**: `boolean`

Defined in: [XmlObject.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L33)

##### batchSize?

> `optional` **batchSize?**: `number`

Defined in: [XmlObject.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L34)

##### fallbackOnParseError?

> `optional` **fallbackOnParseError?**: `boolean`

Defined in: [XmlObject.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L35)

***

### ProjectionRuntimePlatform

Defined in: [projection/index.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L28)

#### Properties

##### platform

> **platform**: `string`

Defined in: [projection/index.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L29)

##### arch

> **arch**: `string`

Defined in: [projection/index.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L30)

##### libc?

> `optional` **libc?**: [`ProjectionLinuxLibc`](#projectionlinuxlibc)

Defined in: [projection/index.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L31)

***

### ProjectionReaderOptions

Defined in: [projection/index.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L36)

#### Extended by

- [`ParseXmlNodesOptions`](#parsexmlnodesoptions)

#### Properties

##### backend?

> `optional` **backend?**: `StaxXmlRuntimeBackendPreference`

Defined in: [projection/index.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L37)

##### fallbackBackend?

> `optional` **fallbackBackend?**: `"wasm"`

Defined in: [projection/index.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L38)

##### ~~fallbackOnLoadError?~~

> `optional` **fallbackOnLoadError?**: `boolean`

Defined in: [projection/index.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L43)

###### Deprecated

JavaScript is no longer a public projection fallback. Use
`fallbackBackend: "wasm"` when wasm compatibility is intended.

##### platform?

> `optional` **platform?**: [`ProjectionRuntimePlatform`](#projectionruntimeplatform)

Defined in: [projection/index.ts:44](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L44)

##### importPackage?

> `optional` **importPackage?**: [`ProjectionPackageImporter`](#projectionpackageimporter)

Defined in: [projection/index.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L45)

***

### ParseXmlNodesOptions

Defined in: [projection/index.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L48)

Options shared by XML tree and compact object helper parsers.

#### Extends

- [`ParseXmlTreeOptions`](#parsexmltreeoptions).[`ProjectionReaderOptions`](#projectionreaderoptions)

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [XmlObject.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L29)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`encoding`](#encoding)

##### documentMode?

> `optional` **documentMode?**: [`DocumentMode`](#documentmode-2)

Defined in: [XmlObject.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L30)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`documentMode`](#documentmode)

##### autoDecodeEntities?

> `optional` **autoDecodeEntities?**: `boolean`

Defined in: [XmlObject.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L31)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`autoDecodeEntities`](#autodecodeentities)

##### addEntities?

> `optional` **addEntities?**: [`EntityDefinition`](#entitydefinition)[]

Defined in: [XmlObject.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L32)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`addEntities`](#addentities)

##### trimText?

> `optional` **trimText?**: `boolean`

Defined in: [XmlObject.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L33)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`trimText`](#trimtext)

##### batchSize?

> `optional` **batchSize?**: `number`

Defined in: [XmlObject.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L34)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`batchSize`](#batchsize)

##### fallbackOnParseError?

> `optional` **fallbackOnParseError?**: `boolean`

Defined in: [XmlObject.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L35)

###### Inherited from

[`ParseXmlTreeOptions`](#parsexmltreeoptions).[`fallbackOnParseError`](#fallbackonparseerror)

##### backend?

> `optional` **backend?**: `StaxXmlRuntimeBackendPreference`

Defined in: [projection/index.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L37)

###### Inherited from

[`ProjectionReaderOptions`](#projectionreaderoptions).[`backend`](#backend)

##### fallbackBackend?

> `optional` **fallbackBackend?**: `"wasm"`

Defined in: [projection/index.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L38)

###### Inherited from

[`ProjectionReaderOptions`](#projectionreaderoptions).[`fallbackBackend`](#fallbackbackend)

##### ~~fallbackOnLoadError?~~

> `optional` **fallbackOnLoadError?**: `boolean`

Defined in: [projection/index.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L43)

###### Deprecated

JavaScript is no longer a public projection fallback. Use
`fallbackBackend: "wasm"` when wasm compatibility is intended.

###### Inherited from

[`ProjectionReaderOptions`](#projectionreaderoptions).[`fallbackOnLoadError`](#fallbackonloaderror)

##### platform?

> `optional` **platform?**: [`ProjectionRuntimePlatform`](#projectionruntimeplatform)

Defined in: [projection/index.ts:44](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L44)

###### Inherited from

[`ProjectionReaderOptions`](#projectionreaderoptions).[`platform`](#platform-1)

##### importPackage?

> `optional` **importPackage?**: [`ProjectionPackageImporter`](#projectionpackageimporter)

Defined in: [projection/index.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L45)

###### Inherited from

[`ProjectionReaderOptions`](#projectionreaderoptions).[`importPackage`](#importpackage)

***

### XmlElementNode

Defined in: [projection/index.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L52)

#### Properties

##### tagName

> **tagName**: `string`

Defined in: [projection/index.ts:53](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L53)

##### attributes

> **attributes**: `Record`\<`string`, `string`\>

Defined in: [projection/index.ts:54](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L54)

##### children

> **children**: [`XmlNode`](#xmlnode)[]

Defined in: [projection/index.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L55)

***

### ObjectRowsProjectionFieldSpec

Defined in: [projection/index.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L62)

#### Properties

##### outputName

> **outputName**: `string`

Defined in: [projection/index.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L63)

##### valueKind

> **valueKind**: [`ProjectionFieldValueKind`](#projectionfieldvaluekind)

Defined in: [projection/index.ts:64](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L64)

##### sourceKind

> **sourceKind**: [`ProjectionFieldSourceKind`](#projectionfieldsourcekind)

Defined in: [projection/index.ts:65](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L65)

##### sourceName

> **sourceName**: `string`

Defined in: [projection/index.ts:66](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L66)

##### sourcePath?

> `optional` **sourcePath?**: `string`[]

Defined in: [projection/index.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L67)

##### sourcePositions?

> `optional` **sourcePositions?**: `number`[]

Defined in: [projection/index.ts:68](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L68)

##### textMode

> **textMode**: [`ProjectionFieldTextMode`](#projectionfieldtextmode)

Defined in: [projection/index.ts:69](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L69)

***

### ObjectRowsProjectionSpec

Defined in: [projection/index.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L72)

#### Properties

##### itemName

> **itemName**: `string`

Defined in: [projection/index.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L73)

##### itemPosition?

> `optional` **itemPosition?**: `number`

Defined in: [projection/index.ts:74](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L74)

##### fields

> **fields**: [`ObjectRowsProjectionFieldSpec`](#objectrowsprojectionfieldspec)[]

Defined in: [projection/index.ts:75](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L75)

***

### ObjectRowsProjectionColumn

Defined in: [projection/index.ts:78](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L78)

#### Properties

##### present?

> `optional` **present?**: `unknown`[]

Defined in: [projection/index.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L79)

##### values?

> `optional` **values?**: `unknown`[]

Defined in: [projection/index.ts:80](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L80)

##### numberValues?

> `optional` **numberValues?**: `unknown`[]

Defined in: [projection/index.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L81)

##### number\_values?

> `optional` **number\_values?**: `unknown`[]

Defined in: [projection/index.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L82)

##### spanStarts?

> `optional` **spanStarts?**: `unknown`[]

Defined in: [projection/index.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L83)

##### span\_starts?

> `optional` **span\_starts?**: `unknown`[]

Defined in: [projection/index.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L84)

##### spanEnds?

> `optional` **spanEnds?**: `unknown`[]

Defined in: [projection/index.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L85)

##### span\_ends?

> `optional` **span\_ends?**: `unknown`[]

Defined in: [projection/index.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L86)

***

### ObjectRowsProjectionResult

Defined in: [projection/index.ts:89](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L89)

#### Properties

##### inputBytes?

> `optional` **inputBytes?**: `number`

Defined in: [projection/index.ts:90](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L90)

##### input\_bytes?

> `optional` **input\_bytes?**: `number`

Defined in: [projection/index.ts:91](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L91)

##### eventCount?

> `optional` **eventCount?**: `number`

Defined in: [projection/index.ts:92](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L92)

##### event\_count?

> `optional` **event\_count?**: `number`

Defined in: [projection/index.ts:93](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L93)

##### maxDepth?

> `optional` **maxDepth?**: `number`

Defined in: [projection/index.ts:94](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L94)

##### max\_depth?

> `optional` **max\_depth?**: `number`

Defined in: [projection/index.ts:95](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L95)

##### fieldCount?

> `optional` **fieldCount?**: `number`

Defined in: [projection/index.ts:96](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L96)

##### field\_count?

> `optional` **field\_count?**: `number`

Defined in: [projection/index.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L97)

##### rowCount?

> `optional` **rowCount?**: `number`

Defined in: [projection/index.ts:98](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L98)

##### row\_count?

> `optional` **row\_count?**: `number`

Defined in: [projection/index.ts:99](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L99)

##### columns?

> `optional` **columns?**: [`ObjectRowsProjectionColumn`](#objectrowsprojectioncolumn)[]

Defined in: [projection/index.ts:100](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L100)

***

### ObjectRecordsProjectionResult

Defined in: [projection/index.ts:103](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L103)

#### Properties

##### inputBytes?

> `optional` **inputBytes?**: `number`

Defined in: [projection/index.ts:104](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L104)

##### input\_bytes?

> `optional` **input\_bytes?**: `number`

Defined in: [projection/index.ts:105](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L105)

##### eventCount?

> `optional` **eventCount?**: `number`

Defined in: [projection/index.ts:106](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L106)

##### event\_count?

> `optional` **event\_count?**: `number`

Defined in: [projection/index.ts:107](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L107)

##### maxDepth?

> `optional` **maxDepth?**: `number`

Defined in: [projection/index.ts:108](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L108)

##### max\_depth?

> `optional` **max\_depth?**: `number`

Defined in: [projection/index.ts:109](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L109)

##### fieldCount?

> `optional` **fieldCount?**: `number`

Defined in: [projection/index.ts:110](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L110)

##### field\_count?

> `optional` **field\_count?**: `number`

Defined in: [projection/index.ts:111](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L111)

##### rowCount?

> `optional` **rowCount?**: `number`

Defined in: [projection/index.ts:112](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L112)

##### row\_count?

> `optional` **row\_count?**: `number`

Defined in: [projection/index.ts:113](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L113)

##### json?

> `optional` **json?**: `string`

Defined in: [projection/index.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L114)

##### rows?

> `optional` **rows?**: `unknown`[]

Defined in: [projection/index.ts:115](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L115)

***

### ItemRowsProjectionResult

Defined in: [projection/index.ts:118](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L118)

#### Properties

##### inputBytes?

> `optional` **inputBytes?**: `number`

Defined in: [projection/index.ts:119](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L119)

##### input\_bytes?

> `optional` **input\_bytes?**: `number`

Defined in: [projection/index.ts:120](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L120)

##### eventCount?

> `optional` **eventCount?**: `number`

Defined in: [projection/index.ts:121](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L121)

##### event\_count?

> `optional` **event\_count?**: `number`

Defined in: [projection/index.ts:122](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L122)

##### maxDepth?

> `optional` **maxDepth?**: `number`

Defined in: [projection/index.ts:123](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L123)

##### max\_depth?

> `optional` **max\_depth?**: `number`

Defined in: [projection/index.ts:124](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L124)

##### rows?

> `optional` **rows?**: `unknown`[]

Defined in: [projection/index.ts:125](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L125)

***

### XmlNodesProjectionResult

Defined in: [projection/index.ts:128](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L128)

#### Properties

##### inputBytes?

> `optional` **inputBytes?**: `number`

Defined in: [projection/index.ts:129](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L129)

##### input\_bytes?

> `optional` **input\_bytes?**: `number`

Defined in: [projection/index.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L130)

##### nodeCount?

> `optional` **nodeCount?**: `number`

Defined in: [projection/index.ts:131](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L131)

##### node\_count?

> `optional` **node\_count?**: `number`

Defined in: [projection/index.ts:132](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L132)

##### json?

> `optional` **json?**: `string`

Defined in: [projection/index.ts:133](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L133)

##### nodes?

> `optional` **nodes?**: `unknown`[]

Defined in: [projection/index.ts:134](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L134)

## Type Aliases

### XmlSyncInput

> **XmlSyncInput** = `string` \| `Uint8Array` \| `Iterable`\<`Uint8Array`\>

Defined in: [XmlObject.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L22)

XML inputs that can be parsed without crossing an async boundary.

***

### XmlAsyncInput

> **XmlAsyncInput** = [`XmlSyncInput`](#xmlsyncinput) \| `AsyncIterable`\<`Uint8Array`\> \| `ReadableStream`\<`Uint8Array`\>

Defined in: [XmlObject.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/XmlObject.ts#L25)

XML inputs accepted by the convenience tree/object helpers.

***

### ProjectionBackendPreference

> **ProjectionBackendPreference** = `StaxXmlRuntimeBackendPreference`

Defined in: [projection/index.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L25)

***

### ProjectionLinuxLibc

> **ProjectionLinuxLibc** = `"gnu"` \| `"musl"`

Defined in: [projection/index.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L26)

***

### ProjectionPackageImporter

> **ProjectionPackageImporter** = (`packageName`) => `Promise`\<`unknown`\>

Defined in: [projection/index.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L34)

#### Parameters

##### packageName

`string`

#### Returns

`Promise`\<`unknown`\>

***

### XmlNode

> **XmlNode** = `string` \| [`XmlElementNode`](#xmlelementnode)

Defined in: [projection/index.ts:50](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L50)

***

### ProjectionFieldValueKind

> **ProjectionFieldValueKind** = `"string"` \| `"number"`

Defined in: [projection/index.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L58)

***

### ProjectionFieldSourceKind

> **ProjectionFieldSourceKind** = `"attribute"` \| `"element"`

Defined in: [projection/index.ts:59](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L59)

***

### ProjectionFieldTextMode

> **ProjectionFieldTextMode** = `"direct"` \| `"subtree"`

Defined in: [projection/index.ts:60](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L60)

***

### DocumentMode

> **DocumentMode** = `"fragment"` \| `"document"`

Defined in: [types.ts:373](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L373)

XML document conformance mode.

## Functions

### parseXmlNodes()

> **parseXmlNodes**(`input`, `options?`): `Promise`\<[`XmlNode`](#xmlnode)[]\>

Defined in: [projection/index.ts:255](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L255)

#### Parameters

##### input

[`XmlAsyncInput`](#xmlasyncinput)

##### options?

[`ParseXmlNodesOptions`](#parsexmlnodesoptions) = `{}`

#### Returns

`Promise`\<[`XmlNode`](#xmlnode)[]\>

***

### parseXmlNodesSync()

> **parseXmlNodesSync**(`input`, `options?`): [`XmlNode`](#xmlnode)[]

Defined in: [projection/index.ts:266](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L266)

#### Parameters

##### input

[`XmlSyncInput`](#xmlsyncinput)

##### options?

[`ParseXmlNodesOptions`](#parsexmlnodesoptions) = `{}`

#### Returns

[`XmlNode`](#xmlnode)[]

***

### projectXmlObjectRows()

> **projectXmlObjectRows**(`input`, `spec`, `options?`): `Promise`\<[`ObjectRowsProjectionResult`](#objectrowsprojectionresult)\>

Defined in: [projection/index.ts:277](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L277)

#### Parameters

##### input

`ArrayBufferView`

##### spec

[`ObjectRowsProjectionSpec`](#objectrowsprojectionspec)

##### options?

[`ProjectionReaderOptions`](#projectionreaderoptions) = `{}`

#### Returns

`Promise`\<[`ObjectRowsProjectionResult`](#objectrowsprojectionresult)\>

***

### projectXmlObjectRowsSync()

> **projectXmlObjectRowsSync**(`input`, `spec`, `options?`): [`ObjectRowsProjectionResult`](#objectrowsprojectionresult)

Defined in: [projection/index.ts:286](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L286)

#### Parameters

##### input

`ArrayBufferView`

##### spec

[`ObjectRowsProjectionSpec`](#objectrowsprojectionspec)

##### options?

`Pick`\<[`ProjectionReaderOptions`](#projectionreaderoptions), `"backend"`\> = `{}`

#### Returns

[`ObjectRowsProjectionResult`](#objectrowsprojectionresult)

***

### projectXmlItemRows()

> **projectXmlItemRows**(`input`, `options?`): `Promise`\<[`ItemRowsProjectionResult`](#itemrowsprojectionresult)\>

Defined in: [projection/index.ts:295](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L295)

#### Parameters

##### input

`ArrayBufferView`

##### options?

[`ProjectionReaderOptions`](#projectionreaderoptions) = `{}`

#### Returns

`Promise`\<[`ItemRowsProjectionResult`](#itemrowsprojectionresult)\>

***

### projectXmlItemRowsSync()

> **projectXmlItemRowsSync**(`input`, `options?`): [`ItemRowsProjectionResult`](#itemrowsprojectionresult)

Defined in: [projection/index.ts:303](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L303)

#### Parameters

##### input

`ArrayBufferView`

##### options?

`Pick`\<[`ProjectionReaderOptions`](#projectionreaderoptions), `"backend"`\> = `{}`

#### Returns

[`ItemRowsProjectionResult`](#itemrowsprojectionresult)

***

### projectXmlObjectRecords()

> **projectXmlObjectRecords**(`input`, `spec`, `options?`): `Promise`\<[`ObjectRecordsProjectionResult`](#objectrecordsprojectionresult)\>

Defined in: [projection/index.ts:311](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L311)

#### Parameters

##### input

`ArrayBufferView`

##### spec

[`ObjectRowsProjectionSpec`](#objectrowsprojectionspec)

##### options?

[`ProjectionReaderOptions`](#projectionreaderoptions) = `{}`

#### Returns

`Promise`\<[`ObjectRecordsProjectionResult`](#objectrecordsprojectionresult)\>

***

### projectXmlObjectRecordsSync()

> **projectXmlObjectRecordsSync**(`input`, `spec`, `options?`): [`ObjectRecordsProjectionResult`](#objectrecordsprojectionresult)

Defined in: [projection/index.ts:320](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/projection/index.ts#L320)

#### Parameters

##### input

`ArrayBufferView`

##### spec

[`ObjectRowsProjectionSpec`](#objectrowsprojectionspec)

##### options?

`Pick`\<[`ProjectionReaderOptions`](#projectionreaderoptions), `"backend"`\> = `{}`

#### Returns

[`ObjectRecordsProjectionResult`](#objectrecordsprojectionresult)
