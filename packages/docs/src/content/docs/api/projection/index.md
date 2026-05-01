---
title: stax-xml
description: API reference for stax-xml
---

**stax-xml**

***

# stax-xml

## Classes

### ProjectionReader

Defined in: projection/index.ts:134

#### Constructors

##### Constructor

> **new ProjectionReader**(`options?`): [`ProjectionReader`](#projectionreader)

Defined in: projection/index.ts:140

###### Parameters

###### options?

[`ProjectionReaderOptions`](#projectionreaderoptions) = `{}`

###### Returns

[`ProjectionReader`](#projectionreader)

#### Methods

##### parseNodes()

> **parseNodes**(`input`, `options?`): `Promise`\<[`XmlNode`](#xmlnode)[]\>

Defined in: projection/index.ts:142

###### Parameters

###### input

[`XmlAsyncInput`](#xmlasyncinput)

###### options?

[`ParseXmlNodesOptions`](#parsexmlnodesoptions)

###### Returns

`Promise`\<[`XmlNode`](#xmlnode)[]\>

##### parseNodesSync()

> **parseNodesSync**(`input`, `options?`): [`XmlNode`](#xmlnode)[]

Defined in: projection/index.ts:152

###### Parameters

###### input

[`XmlSyncInput`](#xmlsyncinput)

###### options?

[`ParseXmlNodesOptions`](#parsexmlnodesoptions)

###### Returns

[`XmlNode`](#xmlnode)[]

##### projectObjectRows()

> **projectObjectRows**(`input`, `spec`, `options?`): `Promise`\<[`ObjectRowsProjectionResult`](#objectrowsprojectionresult)\>

Defined in: projection/index.ts:162

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

Defined in: projection/index.ts:173

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

Defined in: projection/index.ts:188

###### Parameters

###### input

`ArrayBufferView`

###### options?

[`ProjectionReaderOptions`](#projectionreaderoptions)

###### Returns

`Promise`\<[`ItemRowsProjectionResult`](#itemrowsprojectionresult)\>

##### projectItemRowsSync()

> **projectItemRowsSync**(`input`, `options?`): [`ItemRowsProjectionResult`](#itemrowsprojectionresult)

Defined in: projection/index.ts:198

###### Parameters

###### input

`ArrayBufferView`

###### options?

[`ProjectionReaderOptions`](#projectionreaderoptions)

###### Returns

[`ItemRowsProjectionResult`](#itemrowsprojectionresult)

##### projectObjectRecords()

> **projectObjectRecords**(`input`, `spec`, `options?`): `Promise`\<[`ObjectRecordsProjectionResult`](#objectrecordsprojectionresult)\>

Defined in: projection/index.ts:208

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

Defined in: projection/index.ts:219

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

Defined in: projection/index.ts:28

#### Properties

##### platform

> **platform**: `string`

Defined in: projection/index.ts:29

##### arch

> **arch**: `string`

Defined in: projection/index.ts:30

##### libc?

> `optional` **libc?**: [`ProjectionLinuxLibc`](#projectionlinuxlibc)

Defined in: projection/index.ts:31

***

### ProjectionReaderOptions

Defined in: projection/index.ts:36

#### Extended by

- [`ParseXmlNodesOptions`](#parsexmlnodesoptions)

#### Properties

##### backend?

> `optional` **backend?**: `StaxXmlRuntimeBackendPreference`

Defined in: projection/index.ts:37

##### fallbackBackend?

> `optional` **fallbackBackend?**: `"wasm"`

Defined in: projection/index.ts:38

##### ~~fallbackOnLoadError?~~

> `optional` **fallbackOnLoadError?**: `boolean`

Defined in: projection/index.ts:43

###### Deprecated

JavaScript is no longer a public projection fallback. Use
`fallbackBackend: "wasm"` when wasm compatibility is intended.

##### platform?

> `optional` **platform?**: [`ProjectionRuntimePlatform`](#projectionruntimeplatform)

Defined in: projection/index.ts:44

##### importPackage?

> `optional` **importPackage?**: [`ProjectionPackageImporter`](#projectionpackageimporter)

Defined in: projection/index.ts:45

***

### ParseXmlNodesOptions

Defined in: projection/index.ts:48

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

Defined in: projection/index.ts:37

###### Inherited from

[`ProjectionReaderOptions`](#projectionreaderoptions).[`backend`](#backend)

##### fallbackBackend?

> `optional` **fallbackBackend?**: `"wasm"`

Defined in: projection/index.ts:38

###### Inherited from

[`ProjectionReaderOptions`](#projectionreaderoptions).[`fallbackBackend`](#fallbackbackend)

##### ~~fallbackOnLoadError?~~

> `optional` **fallbackOnLoadError?**: `boolean`

Defined in: projection/index.ts:43

###### Deprecated

JavaScript is no longer a public projection fallback. Use
`fallbackBackend: "wasm"` when wasm compatibility is intended.

###### Inherited from

[`ProjectionReaderOptions`](#projectionreaderoptions).[`fallbackOnLoadError`](#fallbackonloaderror)

##### platform?

> `optional` **platform?**: [`ProjectionRuntimePlatform`](#projectionruntimeplatform)

Defined in: projection/index.ts:44

###### Inherited from

[`ProjectionReaderOptions`](#projectionreaderoptions).[`platform`](#platform-1)

##### importPackage?

> `optional` **importPackage?**: [`ProjectionPackageImporter`](#projectionpackageimporter)

Defined in: projection/index.ts:45

###### Inherited from

[`ProjectionReaderOptions`](#projectionreaderoptions).[`importPackage`](#importpackage)

***

### XmlElementNode

Defined in: projection/index.ts:52

#### Properties

##### tagName

> **tagName**: `string`

Defined in: projection/index.ts:53

##### attributes

> **attributes**: `Record`\<`string`, `string`\>

Defined in: projection/index.ts:54

##### children

> **children**: [`XmlNode`](#xmlnode)[]

Defined in: projection/index.ts:55

***

### ObjectRowsProjectionFieldSpec

Defined in: projection/index.ts:62

#### Properties

##### outputName

> **outputName**: `string`

Defined in: projection/index.ts:63

##### valueKind

> **valueKind**: [`ProjectionFieldValueKind`](#projectionfieldvaluekind)

Defined in: projection/index.ts:64

##### sourceKind

> **sourceKind**: [`ProjectionFieldSourceKind`](#projectionfieldsourcekind)

Defined in: projection/index.ts:65

##### sourceName

> **sourceName**: `string`

Defined in: projection/index.ts:66

##### textMode

> **textMode**: [`ProjectionFieldTextMode`](#projectionfieldtextmode)

Defined in: projection/index.ts:67

***

### ObjectRowsProjectionSpec

Defined in: projection/index.ts:70

#### Properties

##### itemName

> **itemName**: `string`

Defined in: projection/index.ts:71

##### fields

> **fields**: [`ObjectRowsProjectionFieldSpec`](#objectrowsprojectionfieldspec)[]

Defined in: projection/index.ts:72

***

### ObjectRowsProjectionColumn

Defined in: projection/index.ts:75

#### Properties

##### present?

> `optional` **present?**: `unknown`[]

Defined in: projection/index.ts:76

##### values?

> `optional` **values?**: `unknown`[]

Defined in: projection/index.ts:77

##### numberValues?

> `optional` **numberValues?**: `unknown`[]

Defined in: projection/index.ts:78

##### number\_values?

> `optional` **number\_values?**: `unknown`[]

Defined in: projection/index.ts:79

##### spanStarts?

> `optional` **spanStarts?**: `unknown`[]

Defined in: projection/index.ts:80

##### span\_starts?

> `optional` **span\_starts?**: `unknown`[]

Defined in: projection/index.ts:81

##### spanEnds?

> `optional` **spanEnds?**: `unknown`[]

Defined in: projection/index.ts:82

##### span\_ends?

> `optional` **span\_ends?**: `unknown`[]

Defined in: projection/index.ts:83

***

### ObjectRowsProjectionResult

Defined in: projection/index.ts:86

#### Properties

##### inputBytes?

> `optional` **inputBytes?**: `number`

Defined in: projection/index.ts:87

##### input\_bytes?

> `optional` **input\_bytes?**: `number`

Defined in: projection/index.ts:88

##### eventCount?

> `optional` **eventCount?**: `number`

Defined in: projection/index.ts:89

##### event\_count?

> `optional` **event\_count?**: `number`

Defined in: projection/index.ts:90

##### maxDepth?

> `optional` **maxDepth?**: `number`

Defined in: projection/index.ts:91

##### max\_depth?

> `optional` **max\_depth?**: `number`

Defined in: projection/index.ts:92

##### fieldCount?

> `optional` **fieldCount?**: `number`

Defined in: projection/index.ts:93

##### field\_count?

> `optional` **field\_count?**: `number`

Defined in: projection/index.ts:94

##### rowCount?

> `optional` **rowCount?**: `number`

Defined in: projection/index.ts:95

##### row\_count?

> `optional` **row\_count?**: `number`

Defined in: projection/index.ts:96

##### columns?

> `optional` **columns?**: [`ObjectRowsProjectionColumn`](#objectrowsprojectioncolumn)[]

Defined in: projection/index.ts:97

***

### ObjectRecordsProjectionResult

Defined in: projection/index.ts:100

#### Properties

##### inputBytes?

> `optional` **inputBytes?**: `number`

Defined in: projection/index.ts:101

##### input\_bytes?

> `optional` **input\_bytes?**: `number`

Defined in: projection/index.ts:102

##### eventCount?

> `optional` **eventCount?**: `number`

Defined in: projection/index.ts:103

##### event\_count?

> `optional` **event\_count?**: `number`

Defined in: projection/index.ts:104

##### maxDepth?

> `optional` **maxDepth?**: `number`

Defined in: projection/index.ts:105

##### max\_depth?

> `optional` **max\_depth?**: `number`

Defined in: projection/index.ts:106

##### fieldCount?

> `optional` **fieldCount?**: `number`

Defined in: projection/index.ts:107

##### field\_count?

> `optional` **field\_count?**: `number`

Defined in: projection/index.ts:108

##### rowCount?

> `optional` **rowCount?**: `number`

Defined in: projection/index.ts:109

##### row\_count?

> `optional` **row\_count?**: `number`

Defined in: projection/index.ts:110

##### json?

> `optional` **json?**: `string`

Defined in: projection/index.ts:111

##### rows?

> `optional` **rows?**: `unknown`[]

Defined in: projection/index.ts:112

***

### ItemRowsProjectionResult

Defined in: projection/index.ts:115

#### Properties

##### inputBytes?

> `optional` **inputBytes?**: `number`

Defined in: projection/index.ts:116

##### input\_bytes?

> `optional` **input\_bytes?**: `number`

Defined in: projection/index.ts:117

##### eventCount?

> `optional` **eventCount?**: `number`

Defined in: projection/index.ts:118

##### event\_count?

> `optional` **event\_count?**: `number`

Defined in: projection/index.ts:119

##### maxDepth?

> `optional` **maxDepth?**: `number`

Defined in: projection/index.ts:120

##### max\_depth?

> `optional` **max\_depth?**: `number`

Defined in: projection/index.ts:121

##### rows?

> `optional` **rows?**: `unknown`[]

Defined in: projection/index.ts:122

***

### XmlNodesProjectionResult

Defined in: projection/index.ts:125

#### Properties

##### inputBytes?

> `optional` **inputBytes?**: `number`

Defined in: projection/index.ts:126

##### input\_bytes?

> `optional` **input\_bytes?**: `number`

Defined in: projection/index.ts:127

##### nodeCount?

> `optional` **nodeCount?**: `number`

Defined in: projection/index.ts:128

##### node\_count?

> `optional` **node\_count?**: `number`

Defined in: projection/index.ts:129

##### json?

> `optional` **json?**: `string`

Defined in: projection/index.ts:130

##### nodes?

> `optional` **nodes?**: `unknown`[]

Defined in: projection/index.ts:131

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

Defined in: projection/index.ts:25

***

### ProjectionLinuxLibc

> **ProjectionLinuxLibc** = `"gnu"` \| `"musl"`

Defined in: projection/index.ts:26

***

### ProjectionPackageImporter

> **ProjectionPackageImporter** = (`packageName`) => `Promise`\<`unknown`\>

Defined in: projection/index.ts:34

#### Parameters

##### packageName

`string`

#### Returns

`Promise`\<`unknown`\>

***

### XmlNode

> **XmlNode** = `string` \| [`XmlElementNode`](#xmlelementnode)

Defined in: projection/index.ts:50

***

### ProjectionFieldValueKind

> **ProjectionFieldValueKind** = `"string"` \| `"number"`

Defined in: projection/index.ts:58

***

### ProjectionFieldSourceKind

> **ProjectionFieldSourceKind** = `"attribute"` \| `"element"`

Defined in: projection/index.ts:59

***

### ProjectionFieldTextMode

> **ProjectionFieldTextMode** = `"direct"` \| `"subtree"`

Defined in: projection/index.ts:60

***

### DocumentMode

> **DocumentMode** = `"fragment"` \| `"document"`

Defined in: [types.ts:373](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/types.ts#L373)

XML document conformance mode.

## Functions

### parseXmlNodes()

> **parseXmlNodes**(`input`, `options?`): `Promise`\<[`XmlNode`](#xmlnode)[]\>

Defined in: projection/index.ts:252

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

Defined in: projection/index.ts:263

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

Defined in: projection/index.ts:274

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

Defined in: projection/index.ts:283

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

Defined in: projection/index.ts:292

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

Defined in: projection/index.ts:300

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

Defined in: projection/index.ts:308

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

Defined in: projection/index.ts:317

#### Parameters

##### input

`ArrayBufferView`

##### spec

[`ObjectRowsProjectionSpec`](#objectrowsprojectionspec)

##### options?

`Pick`\<[`ProjectionReaderOptions`](#projectionreaderoptions), `"backend"`\> = `{}`

#### Returns

[`ObjectRecordsProjectionResult`](#objectrecordsprojectionresult)
