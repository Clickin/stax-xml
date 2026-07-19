---
title: stax-xml
description: API reference for stax-xml
---

**stax-xml**

***

# stax-xml

## Classes

### XmlParseError

Defined in: [errors.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/errors.ts#L6)

XML parse error with detailed issue information

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new XmlParseError**(`issues`): [`XmlParseError`](#xmlparseerror)

Defined in: [errors.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/errors.ts#L16)

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

Defined in: [errors.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/errors.ts#L10)

List of validation issues

###### path

> **path**: `string`[]

###### message

> **message**: `string`

###### code

> **code**: `string`

## Interfaces

### XmlArraySchema

Defined in: [XmlArraySchema.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlArraySchema.ts#L20)

Schema for parsing XML array values

#### Extends

- [`XmlSchemaBase`](#xmlschemabase)\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

#### Type Parameters

##### T

`T` *extends* [`XmlSchemaBase`](#xmlschemabase)\<`unknown`, `unknown`\>

#### Properties

##### element

> `readonly` **element**: `T`

Defined in: [XmlArraySchema.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlArraySchema.ts#L26)

##### xpath?

> `readonly` `optional` **xpath?**: `string`

Defined in: [XmlArraySchema.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlArraySchema.ts#L27)

##### \_output

> `readonly` **\_output**: `T`\[`"_output"`\][]

Defined in: [base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L32)

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`_output`](#_output-7)

##### \_input

> `readonly` **\_input**: `T`\[`"_input"`\][]

Defined in: [base.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L33)

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`_input`](#_input-7)

#### Methods

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`T`\[`"_output"`\][]\>

Defined in: [base.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L84)

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

[`XmlSchemaBase`](#xmlschemabase).[`parse`](#parse-7)

##### parseSync()

> **parseSync**(`input`, `options?`): `T`\[`"_output"`\][]

Defined in: [base.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L97)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

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

[`XmlSchemaBase`](#xmlschemabase).[`parseSync`](#parsesync-7)

##### precompile()

> **precompile**(): `this`

Defined in: [base.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L114)

Build and cache the schema-specific IR program before parsing.

Normal `parse()` and `parseSync()` calls do this automatically. Call
`precompile()` during server or worker startup only when the one-time
lowering and executor creation cost should happen before the first request.
The returned schema is the same instance, so startup code can precompile a
shared schema and request handlers can use it normally.

###### Returns

`this`

This schema instance

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`precompile`](#precompile-7)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`T`\[`"_output"`\][]\>\>

Defined in: [base.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L127)

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

[`XmlSchemaBase`](#xmlschemabase).[`safeParse`](#safeparse-7)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`T`\[`"_output"`\][]\>

Defined in: [base.ts:148](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L148)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`T`\[`"_output"`\][]\>

Parse result with success flag

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`safeParseSync`](#safeparsesync-7)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `T`\[`"_input"`\][]\>

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L168)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `T`\[`"_input"`\][]\>

New schema with transform applied

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`transform`](#transform-7)

##### optional()

> **optional**(): [`XmlSchemaBase`](#xmlschemabase)\<`T`\[`"_output"`\][] \| `undefined`, `T`\[`"_input"`\][] \| `undefined`\>

Defined in: [base.ts:176](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L176)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`T`\[`"_output"`\][] \| `undefined`, `T`\[`"_input"`\][] \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`optional`](#optional-7)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#xmlschemabase)\<`T`\[`"_output"`\][][], `T`\[`"_input"`\][][]\>

Defined in: [base.ts:185](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L185)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`T`\[`"_output"`\][][], `T`\[`"_input"`\][][]\>

New array schema

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`array`](#array-8)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:195](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L195)

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

[`XmlSchemaBase`](#xmlschemabase).[`write`](#write-7)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:218](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L218)

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

[`XmlSchemaBase`](#xmlschemabase).[`writeToStream`](#writetostream-7)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:232](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L232)

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

[`XmlSchemaBase`](#xmlschemabase).[`writeSync`](#writesync-7)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:241](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L241)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`writer`](#writer-7)

***

### XmlBuilder

Defined in: [XmlBuilder.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlBuilder.ts#L13)

Builder API for creating XML schemas

#### Methods

##### string()

> **string**(`xpath?`): [`XmlStringSchema`](#xmlstringschema)

Defined in: [XmlBuilder.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlBuilder.ts#L19)

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

Defined in: [XmlBuilder.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlBuilder.ts#L28)

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

Defined in: [XmlBuilder.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlBuilder.ts#L38)

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

Defined in: [XmlBuilder.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlBuilder.ts#L48)

Create an array schema

###### Type Parameters

###### T

`T` *extends* [`XmlSchema`](#xmlschema)\<`unknown`, `unknown`\>

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

Defined in: [XmlNumberSchema.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlNumberSchema.ts#L19)

Schema for parsing XML number values

#### Extends

- [`XmlSchema`](#xmlschema)\<`number`, `number`\>

#### Properties

##### options

> **options**: [`XmlNumberOptions`](#xmlnumberoptions) = `{}`

Defined in: [XmlNumberSchema.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlNumberSchema.ts#L22)

##### \_output

> `readonly` **\_output**: `number`

Defined in: [base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L32)

###### Inherited from

[`XmlSchema`](#xmlschema).[`_output`](#_output-4)

##### \_input

> `readonly` **\_input**: `number`

Defined in: [base.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L33)

###### Inherited from

[`XmlSchema`](#xmlschema).[`_input`](#_input-4)

#### Methods

##### xpath()

> **xpath**(`path`): [`XmlNumberSchema`](#xmlnumberschema)

Defined in: [XmlNumberSchema.ts:90](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlNumberSchema.ts#L90)

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

Defined in: [XmlNumberSchema.ts:99](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlNumberSchema.ts#L99)

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

Defined in: [XmlNumberSchema.ts:108](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlNumberSchema.ts#L108)

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

Defined in: [XmlNumberSchema.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlNumberSchema.ts#L116)

Require integer value

###### Returns

[`XmlNumberSchema`](#xmlnumberschema)

New schema that only accepts integers

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`number`\>

Defined in: [base.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L84)

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

[`XmlSchema`](#xmlschema).[`parse`](#parse-4)

##### parseSync()

> **parseSync**(`input`, `options?`): `number`

Defined in: [base.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L97)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

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

[`XmlSchema`](#xmlschema).[`parseSync`](#parsesync-4)

##### precompile()

> **precompile**(): `this`

Defined in: [base.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L114)

Build and cache the schema-specific IR program before parsing.

Normal `parse()` and `parseSync()` calls do this automatically. Call
`precompile()` during server or worker startup only when the one-time
lowering and executor creation cost should happen before the first request.
The returned schema is the same instance, so startup code can precompile a
shared schema and request handlers can use it normally.

###### Returns

`this`

This schema instance

###### Inherited from

[`XmlSchema`](#xmlschema).[`precompile`](#precompile-4)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`number`\>\>

Defined in: [base.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L127)

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

[`XmlSchema`](#xmlschema).[`safeParse`](#safeparse-4)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`number`\>

Defined in: [base.ts:148](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L148)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`number`\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#xmlschema).[`safeParseSync`](#safeparsesync-4)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `number`\>

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L168)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `number`\>

New schema with transform applied

###### Inherited from

[`XmlSchema`](#xmlschema).[`transform`](#transform-4)

##### optional()

> **optional**(): [`XmlSchemaBase`](#xmlschemabase)\<`number` \| `undefined`, `number` \| `undefined`\>

Defined in: [base.ts:176](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L176)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`number` \| `undefined`, `number` \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`optional`](#optional-4)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#xmlschemabase)\<`number`[], `number`[]\>

Defined in: [base.ts:185](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L185)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`number`[], `number`[]\>

New array schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`array`](#array-5)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:195](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L195)

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

[`XmlSchema`](#xmlschema).[`write`](#write-4)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:218](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L218)

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

[`XmlSchema`](#xmlschema).[`writeToStream`](#writetostream-4)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:232](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L232)

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

[`XmlSchema`](#xmlschema).[`writeSync`](#writesync-4)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:241](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L241)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchema`](#xmlschema).[`writer`](#writer-4)

***

### XmlObjectSchema

Defined in: [XmlObjectSchema.ts:37](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlObjectSchema.ts#L37)

Schema for parsing XML object values

#### Extends

- [`XmlSchema`](#xmlschema)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>, `unknown`\>

#### Type Parameters

##### T

`T` *extends* [`XmlObjectShape`](#xmlobjectshape)

#### Properties

##### shape

> `readonly` **shape**: `T`

Defined in: [XmlObjectSchema.ts:44](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlObjectSchema.ts#L44)

##### options

> **options**: [`XmlObjectOptions`](#xmlobjectoptions) = `{}`

Defined in: [XmlObjectSchema.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlObjectSchema.ts#L45)

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L32)

###### Inherited from

[`XmlSchema`](#xmlschema).[`_output`](#_output-4)

##### \_input

> `readonly` **\_input**: `unknown`

Defined in: [base.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L33)

###### Inherited from

[`XmlSchema`](#xmlschema).[`_input`](#_input-4)

#### Methods

##### xpath()

> **xpath**(`path`): [`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

Defined in: [XmlObjectSchema.ts:56](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlObjectSchema.ts#L56)

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

Defined in: [base.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L84)

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

[`XmlSchema`](#xmlschema).[`parse`](#parse-4)

##### parseSync()

> **parseSync**(`input`, `options?`): `Output`

Defined in: [base.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L97)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

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

[`XmlSchema`](#xmlschema).[`parseSync`](#parsesync-4)

##### precompile()

> **precompile**(): `this`

Defined in: [base.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L114)

Build and cache the schema-specific IR program before parsing.

Normal `parse()` and `parseSync()` calls do this automatically. Call
`precompile()` during server or worker startup only when the one-time
lowering and executor creation cost should happen before the first request.
The returned schema is the same instance, so startup code can precompile a
shared schema and request handlers can use it normally.

###### Returns

`this`

This schema instance

###### Inherited from

[`XmlSchema`](#xmlschema).[`precompile`](#precompile-4)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>\>

Defined in: [base.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L127)

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

[`XmlSchema`](#xmlschema).[`safeParse`](#safeparse-4)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Defined in: [base.ts:148](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L148)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#xmlschema).[`safeParseSync`](#safeparsesync-4)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `unknown`\>

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L168)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `unknown`\>

New schema with transform applied

###### Inherited from

[`XmlSchema`](#xmlschema).[`transform`](#transform-4)

##### optional()

> **optional**(): [`XmlSchemaBase`](#xmlschemabase)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\> \| `undefined`, `unknown`\>

Defined in: [base.ts:176](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L176)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\> \| `undefined`, `unknown`\>

New optional schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`optional`](#optional-4)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#xmlschemabase)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>[], `unknown`[]\>

Defined in: [base.ts:185](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L185)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>[], `unknown`[]\>

New array schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`array`](#array-5)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:195](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L195)

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

[`XmlSchema`](#xmlschema).[`write`](#write-4)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:218](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L218)

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

[`XmlSchema`](#xmlschema).[`writeToStream`](#writetostream-4)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:232](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L232)

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

[`XmlSchema`](#xmlschema).[`writeSync`](#writesync-4)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:241](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L241)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchema`](#xmlschema).[`writer`](#writer-4)

***

### XmlOptionalSchema

Defined in: [XmlOptionalSchema.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlOptionalSchema.ts#L11)

Schema for optional values

#### Extends

- [`XmlSchemaBase`](#xmlschemabase)\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

#### Type Parameters

##### T

`T` *extends* [`XmlSchemaBase`](#xmlschemabase)\<`unknown`, `unknown`\>

#### Properties

##### schema

> `readonly` **schema**: `T`

Defined in: [XmlOptionalSchema.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlOptionalSchema.ts#L14)

##### \_output

> `readonly` **\_output**: `T`\[`"_output"`\] \| `undefined`

Defined in: [base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L32)

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`_output`](#_output-7)

##### \_input

> `readonly` **\_input**: `T`\[`"_input"`\] \| `undefined`

Defined in: [base.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L33)

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`_input`](#_input-7)

#### Methods

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`T`\[`"_output"`\] \| `undefined`\>

Defined in: [base.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L84)

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

[`XmlSchemaBase`](#xmlschemabase).[`parse`](#parse-7)

##### parseSync()

> **parseSync**(`input`, `options?`): `T`\[`"_output"`\] \| `undefined`

Defined in: [base.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L97)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

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

[`XmlSchemaBase`](#xmlschemabase).[`parseSync`](#parsesync-7)

##### precompile()

> **precompile**(): `this`

Defined in: [base.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L114)

Build and cache the schema-specific IR program before parsing.

Normal `parse()` and `parseSync()` calls do this automatically. Call
`precompile()` during server or worker startup only when the one-time
lowering and executor creation cost should happen before the first request.
The returned schema is the same instance, so startup code can precompile a
shared schema and request handlers can use it normally.

###### Returns

`this`

This schema instance

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`precompile`](#precompile-7)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`T`\[`"_output"`\] \| `undefined`\>\>

Defined in: [base.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L127)

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

[`XmlSchemaBase`](#xmlschemabase).[`safeParse`](#safeparse-7)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`T`\[`"_output"`\] \| `undefined`\>

Defined in: [base.ts:148](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L148)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`T`\[`"_output"`\] \| `undefined`\>

Parse result with success flag

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`safeParseSync`](#safeparsesync-7)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L168)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `T`\[`"_input"`\] \| `undefined`\>

New schema with transform applied

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`transform`](#transform-7)

##### optional()

> **optional**(): [`XmlSchemaBase`](#xmlschemabase)\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [base.ts:176](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L176)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`optional`](#optional-7)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#xmlschemabase)\<(`T`\[`"_output"`\] \| `undefined`)[], (`T`\[`"_input"`\] \| `undefined`)[]\>

Defined in: [base.ts:185](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L185)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<(`T`\[`"_output"`\] \| `undefined`)[], (`T`\[`"_input"`\] \| `undefined`)[]\>

New array schema

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`array`](#array-8)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:195](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L195)

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

[`XmlSchemaBase`](#xmlschemabase).[`write`](#write-7)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:218](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L218)

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

[`XmlSchemaBase`](#xmlschemabase).[`writeToStream`](#writetostream-7)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:232](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L232)

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

[`XmlSchemaBase`](#xmlschemabase).[`writeSync`](#writesync-7)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:241](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L241)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`writer`](#writer-7)

***

### XmlSchema

Defined in: [XmlSchema.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlSchema.ts#L10)

Main XML schema class (extends XmlSchemaBase with all methods)

#### Extends

- [`XmlSchemaBase`](#xmlschemabase)\<`Output`, `Input`\>

#### Extended by

- [`XmlStringSchema`](#xmlstringschema)
- [`XmlNumberSchema`](#xmlnumberschema)
- [`XmlObjectSchema`](#xmlobjectschema)

#### Type Parameters

##### Output

`Output`

##### Input

`Input` = `Output`

#### Properties

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L32)

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`_output`](#_output-7)

##### \_input

> `readonly` **\_input**: `Input`

Defined in: [base.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L33)

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`_input`](#_input-7)

#### Methods

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [base.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L84)

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

[`XmlSchemaBase`](#xmlschemabase).[`parse`](#parse-7)

##### parseSync()

> **parseSync**(`input`, `options?`): `Output`

Defined in: [base.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L97)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

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

[`XmlSchemaBase`](#xmlschemabase).[`parseSync`](#parsesync-7)

##### precompile()

> **precompile**(): `this`

Defined in: [base.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L114)

Build and cache the schema-specific IR program before parsing.

Normal `parse()` and `parseSync()` calls do this automatically. Call
`precompile()` during server or worker startup only when the one-time
lowering and executor creation cost should happen before the first request.
The returned schema is the same instance, so startup code can precompile a
shared schema and request handlers can use it normally.

###### Returns

`this`

This schema instance

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`precompile`](#precompile-7)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Defined in: [base.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L127)

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

[`XmlSchemaBase`](#xmlschemabase).[`safeParse`](#safeparse-7)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`Output`\>

Defined in: [base.ts:148](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L148)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`Output`\>

Parse result with success flag

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`safeParseSync`](#safeparsesync-7)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `Input`\>

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L168)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `Input`\>

New schema with transform applied

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`transform`](#transform-7)

##### optional()

> **optional**(): [`XmlSchemaBase`](#xmlschemabase)\<`Output` \| `undefined`, `Input` \| `undefined`\>

Defined in: [base.ts:176](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L176)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`Output` \| `undefined`, `Input` \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`optional`](#optional-7)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#xmlschemabase)\<`Output`[], `Input`[]\>

Defined in: [base.ts:185](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L185)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`Output`[], `Input`[]\>

New array schema

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`array`](#array-8)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:195](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L195)

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

[`XmlSchemaBase`](#xmlschemabase).[`write`](#write-7)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:218](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L218)

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

[`XmlSchemaBase`](#xmlschemabase).[`writeToStream`](#writetostream-7)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:232](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L232)

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

[`XmlSchemaBase`](#xmlschemabase).[`writeSync`](#writesync-7)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:241](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L241)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`writer`](#writer-7)

***

### XmlStringSchema

Defined in: [XmlStringSchema.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlStringSchema.ts#L30)

Schema for parsing XML string values

#### Extends

- [`XmlSchema`](#xmlschema)\<`string`, `string`\>

#### Properties

##### options

> **options**: [`XmlStringOptions`](#xmlstringoptions) = `{}`

Defined in: [XmlStringSchema.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlStringSchema.ts#L33)

##### \_output

> `readonly` **\_output**: `string`

Defined in: [base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L32)

###### Inherited from

[`XmlSchema`](#xmlschema).[`_output`](#_output-4)

##### \_input

> `readonly` **\_input**: `string`

Defined in: [base.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L33)

###### Inherited from

[`XmlSchema`](#xmlschema).[`_input`](#_input-4)

#### Methods

##### xpath()

> **xpath**(`path`): [`XmlStringSchema`](#xmlstringschema)

Defined in: [XmlStringSchema.ts:47](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlStringSchema.ts#L47)

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

Defined in: [base.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L84)

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

[`XmlSchema`](#xmlschema).[`parse`](#parse-4)

##### parseSync()

> **parseSync**(`input`, `options?`): `string`

Defined in: [base.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L97)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

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

[`XmlSchema`](#xmlschema).[`parseSync`](#parsesync-4)

##### precompile()

> **precompile**(): `this`

Defined in: [base.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L114)

Build and cache the schema-specific IR program before parsing.

Normal `parse()` and `parseSync()` calls do this automatically. Call
`precompile()` during server or worker startup only when the one-time
lowering and executor creation cost should happen before the first request.
The returned schema is the same instance, so startup code can precompile a
shared schema and request handlers can use it normally.

###### Returns

`this`

This schema instance

###### Inherited from

[`XmlSchema`](#xmlschema).[`precompile`](#precompile-4)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`string`\>\>

Defined in: [base.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L127)

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

[`XmlSchema`](#xmlschema).[`safeParse`](#safeparse-4)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`string`\>

Defined in: [base.ts:148](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L148)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`string`\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#xmlschema).[`safeParseSync`](#safeparsesync-4)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `string`\>

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L168)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `string`\>

New schema with transform applied

###### Inherited from

[`XmlSchema`](#xmlschema).[`transform`](#transform-4)

##### optional()

> **optional**(): [`XmlSchemaBase`](#xmlschemabase)\<`string` \| `undefined`, `string` \| `undefined`\>

Defined in: [base.ts:176](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L176)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`string` \| `undefined`, `string` \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`optional`](#optional-4)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#xmlschemabase)\<`string`[], `string`[]\>

Defined in: [base.ts:185](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L185)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`string`[], `string`[]\>

New array schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`array`](#array-5)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:195](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L195)

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

[`XmlSchema`](#xmlschema).[`write`](#write-4)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:218](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L218)

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

[`XmlSchema`](#xmlschema).[`writeToStream`](#writetostream-4)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:232](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L232)

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

[`XmlSchema`](#xmlschema).[`writeSync`](#writesync-4)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:241](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L241)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchema`](#xmlschema).[`writer`](#writer-4)

***

### XmlTransformSchema

Defined in: [XmlTransformSchema.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlTransformSchema.ts#L10)

Schema for transforming parsed values

#### Extends

- [`XmlSchemaBase`](#xmlschemabase)\<`Output`, `Input`\>

#### Type Parameters

##### Output

`Output`

##### Input

`Input`

##### IntermediateOutput

`IntermediateOutput` = `unknown`

#### Properties

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L32)

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`_output`](#_output-7)

##### \_input

> `readonly` **\_input**: `Input`

Defined in: [base.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L33)

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`_input`](#_input-7)

#### Methods

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [base.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L84)

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

[`XmlSchemaBase`](#xmlschemabase).[`parse`](#parse-7)

##### parseSync()

> **parseSync**(`input`, `options?`): `Output`

Defined in: [base.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L97)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

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

[`XmlSchemaBase`](#xmlschemabase).[`parseSync`](#parsesync-7)

##### precompile()

> **precompile**(): `this`

Defined in: [base.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L114)

Build and cache the schema-specific IR program before parsing.

Normal `parse()` and `parseSync()` calls do this automatically. Call
`precompile()` during server or worker startup only when the one-time
lowering and executor creation cost should happen before the first request.
The returned schema is the same instance, so startup code can precompile a
shared schema and request handlers can use it normally.

###### Returns

`this`

This schema instance

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`precompile`](#precompile-7)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Defined in: [base.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L127)

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

[`XmlSchemaBase`](#xmlschemabase).[`safeParse`](#safeparse-7)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`Output`\>

Defined in: [base.ts:148](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L148)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`Output`\>

Parse result with success flag

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`safeParseSync`](#safeparsesync-7)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `Input`\>

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L168)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `Input`\>

New schema with transform applied

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`transform`](#transform-7)

##### optional()

> **optional**(): [`XmlSchemaBase`](#xmlschemabase)\<`Output` \| `undefined`, `Input` \| `undefined`\>

Defined in: [base.ts:176](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L176)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`Output` \| `undefined`, `Input` \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`optional`](#optional-7)

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#xmlschemabase)\<`Output`[], `Input`[]\>

Defined in: [base.ts:185](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L185)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`Output`[], `Input`[]\>

New array schema

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`array`](#array-8)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:195](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L195)

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

[`XmlSchemaBase`](#xmlschemabase).[`write`](#write-7)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:218](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L218)

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

[`XmlSchemaBase`](#xmlschemabase).[`writeToStream`](#writetostream-7)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:232](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L232)

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

[`XmlSchemaBase`](#xmlschemabase).[`writeSync`](#writesync-7)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:241](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L241)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchemaBase`](#xmlschemabase).[`writer`](#writer-7)

***

### XmlSchemaBase

Defined in: [base.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L31)

Base abstract class for all XML schema types

#### Remarks

This class provides the foundation for zod-style declarative XML parsing.
Each schema type extends this class and implements the parsing logic.

#### Extended by

- [`XmlSchema`](#xmlschema)
- [`XmlArraySchema`](#xmlarrayschema)
- [`XmlOptionalSchema`](#xmloptionalschema)
- [`XmlTransformSchema`](#xmltransformschema)

#### Type Parameters

##### Output

`Output`

##### Input

`Input` = `Output`

#### Properties

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [base.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L32)

##### \_input

> `readonly` **\_input**: `Input`

Defined in: [base.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L33)

#### Methods

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [base.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L84)

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

Defined in: [base.ts:97](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L97)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output`

Parsed output

###### Throws

If parsing fails

##### precompile()

> **precompile**(): `this`

Defined in: [base.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L114)

Build and cache the schema-specific IR program before parsing.

Normal `parse()` and `parseSync()` calls do this automatically. Call
`precompile()` during server or worker startup only when the one-time
lowering and executor creation cost should happen before the first request.
The returned schema is the same instance, so startup code can precompile a
shared schema and request handlers can use it normally.

###### Returns

`this`

This schema instance

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Defined in: [base.ts:127](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L127)

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

Defined in: [base.ts:148](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L148)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `Iterable`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterable`\<`Uint8Array`\<`ArrayBufferLike`\>, `any`, `any`\> \| `Iterable`\<readonly `Uint8Array`\<`ArrayBufferLike`\>[], `any`, `any`\>

XML string, byte view, or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`Output`\>

Parse result with success flag

##### transform()

> **transform**\<`NewOutput`\>(`fn`): [`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `Input`\>

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L168)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`NewOutput`, `Input`\>

New schema with transform applied

##### optional()

> **optional**(): [`XmlSchemaBase`](#xmlschemabase)\<`Output` \| `undefined`, `Input` \| `undefined`\>

Defined in: [base.ts:176](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L176)

Make this schema optional

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`Output` \| `undefined`, `Input` \| `undefined`\>

New optional schema

##### array()

> **array**(`xpath?`): [`XmlSchemaBase`](#xmlschemabase)\<`Output`[], `Input`[]\>

Defined in: [base.ts:185](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L185)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

[`XmlSchemaBase`](#xmlschemabase)\<`Output`[], `Input`[]\>

New array schema

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:195](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L195)

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

Defined in: [base.ts:218](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L218)

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

Defined in: [base.ts:232](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L232)

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

Defined in: [base.ts:241](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L241)

Configure writer settings for this schema

###### Parameters

###### config

[`XmlElementWriteConfig`](#xmlelementwriteconfig)

Writer configuration

###### Returns

`this`

This schema with writer config

***

### ParseOptions

Defined in: [types.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L10)

Parse options for XML converter

#### Properties

##### encoding?

> `optional` **encoding?**: `string`

Defined in: [types.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L16)

TextDecoder encoding label for byte input.
String and materialized-event inputs are already decoded and ignore it.

###### Default Value

```ts
'utf-8'
```

##### trimText?

> `optional` **trimText?**: `boolean`

Defined in: [types.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L22)

Whether to trim whitespace from text content

###### Default Value

```ts
true
```

##### documentMode?

> `optional` **documentMode?**: `DocumentMode`

Defined in: [types.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L29)

XML document conformance mode.

###### Default Value

```ts
'fragment'
```

##### maxDepth?

> `optional` **maxDepth?**: `number`

Defined in: [types.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L35)

Maximum XML depth

###### Default Value

```ts
Infinity
```

##### maxEvents?

> `optional` **maxEvents?**: `number`

Defined in: [types.ts:41](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L41)

Maximum number of events to process

###### Default Value

```ts
Infinity
```

***

### XmlStringOptions

Defined in: [types.ts:50](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L50)

Options for string schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: [types.ts:54](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L54)

XPath expression to locate the element

***

### XmlNumberOptions

Defined in: [types.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L63)

Options for number schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: [types.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L67)

XPath expression to locate the element

##### min?

> `optional` **min?**: `number`

Defined in: [types.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L72)

Minimum value

##### max?

> `optional` **max?**: `number`

Defined in: [types.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L77)

Maximum value

##### int?

> `optional` **int?**: `boolean`

Defined in: [types.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L83)

Whether the number must be an integer

###### Default Value

```ts
false
```

***

### XmlObjectOptions

Defined in: [types.ts:91](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L91)

Options for object schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: [types.ts:95](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L95)

XPath expression to locate the element

***

### XmlElementWriteConfig

Defined in: [types.ts:104](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L104)

Writer configuration for XML element

#### Properties

##### element?

> `optional` **element?**: `string`

Defined in: [types.ts:108](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L108)

Element name. Object fields may omit this to use the field key.

##### asAttribute?

> `optional` **asAttribute?**: `string`

Defined in: [types.ts:114](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L114)

Write as attribute instead of element
Value is the attribute name

##### namespace?

> `optional` **namespace?**: `object`

Defined in: [types.ts:119](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L119)

Namespace configuration

###### prefix?

> `optional` **prefix?**: `string`

Namespace prefix (e.g., 'dc', 'xsi')

###### uri

> **uri**: `string`

Namespace URI (e.g., 'http://purl.org/dc/elements/1.1/')

##### cdata?

> `optional` **cdata?**: `boolean`

Defined in: [types.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L135)

Wrap content in CDATA section

###### Default Value

```ts
false
```

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: [types.ts:141](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L141)

Use self-closing tag for empty elements

###### Default Value

```ts
false
```

##### comment?

> `optional` **comment?**: `string`

Defined in: [types.ts:146](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L146)

Add XML comment before element

***

### XmlWriteOptions

Defined in: [types.ts:154](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L154)

Options for XML writer

#### Properties

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: [types.ts:159](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L159)

Format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString?**: `string`

Defined in: [types.ts:165](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L165)

Indentation string

###### Default Value

```ts
'  '
```

##### encoding?

> `optional` **encoding?**: `"utf-8"` \| `"UTF-8"`

Defined in: [types.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L171)

Text encoding for output

###### Default Value

```ts
'utf-8'
```

##### rootElement?

> `optional` **rootElement?**: `string`

Defined in: [types.ts:177](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L177)

Root element name
If not provided, no root element wrapper is added

##### includeDeclaration?

> `optional` **includeDeclaration?**: `boolean`

Defined in: [types.ts:183](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L183)

Include XML declaration

###### Default Value

```ts
true
```

##### xmlVersion?

> `optional` **xmlVersion?**: `"1.0"`

Defined in: [types.ts:189](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L189)

XML version for declaration

###### Default Value

```ts
'1.0'
```

##### writer?

> `optional` **writer?**: `Writer` \| `WriterSync` \| `WriterSyncSink`

Defined in: [types.ts:197](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/types.ts#L197)

Custom writer instance
- WriterSync: for writeSync() method
- WriterSyncSink: for writeSync() with custom sink
- Writer: for write() async method

## Type Aliases

### XmlObjectShape

> **XmlObjectShape** = `Record`\<`string`, [`XmlSchema`](#xmlschema)\<`unknown`, `unknown`\>\>

Defined in: [XmlObjectSchema.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlObjectSchema.ts#L21)

Shape type for object schema

***

### InferObjectOutput

> **InferObjectOutput**\<`T`\> = `{ [K in keyof T]: T[K]["_output"] }`

Defined in: [XmlObjectSchema.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlObjectSchema.ts#L28)

Infer output type from object shape

#### Type Parameters

##### T

`T` *extends* [`XmlObjectShape`](#xmlobjectshape)

***

### ParseInput

> **ParseInput** = `string` \| `Uint8Array` \| `Iterable`\<`Uint8Array`\> \| `Iterable`\<readonly `Uint8Array`[]\> \| `Iterable`\<`AnyXmlEvent`\> \| `AsyncIterable`\<`Uint8Array`\> \| `AsyncIterable`\<readonly `Uint8Array`[]\> \| `AsyncIterable`\<`AnyXmlEvent`\> \| `ReadableStream`\<`Uint8Array`\>

Defined in: [base.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/base.ts#L11)

Parse input type for XML text, byte chunks, or materialized StAX events.

***

### ParseResult

> **ParseResult**\<`T`\> = \{ `success`: `true`; `data`: `T`; \} \| \{ `success`: `false`; `error`: [`XmlParseError`](#xmlparseerror); \}

Defined in: [errors.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/errors.ts#L28)

Parse result type for safe parsing operations

#### Type Parameters

##### T

`T`

***

### Infer

> **Infer**\<`T`\> = `T`\[`"_output"`\]

Defined in: [index.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/index.ts#L72)

Infer the parsed output type of a converter schema.

#### Type Parameters

##### T

`T` *extends* [`XmlSchema`](#xmlschema)\<`unknown`, `unknown`\>

## Variables

### x

> `const` **x**: [`XmlBuilder`](#xmlbuilder)

Defined in: [XmlBuilder.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/converter/XmlBuilder.ts#L58)

Singleton builder instance
