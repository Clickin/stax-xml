---
title: stax-xml
description: API reference for stax-xml
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

### XmlArraySchema

Defined in: [XmlArraySchema.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L15)

Schema for parsing XML array values

#### Extends

- `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

#### Type Parameters

##### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

#### Constructors

##### Constructor

> **new XmlArraySchema**\<`T`\>(`element`, `xpath?`): [`XmlArraySchema`](#xmlarrayschema)\<`T`\>

Defined in: [XmlArraySchema.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L18)

###### Parameters

###### element

`T`

###### xpath?

`string`

###### Returns

[`XmlArraySchema`](#xmlarrayschema)\<`T`\>

###### Overrides

`XmlSchemaBase<T['_output'][], T['_input'][]>.constructor`

#### Properties

##### schemaType

> `readonly` **schemaType**: `"ARRAY"` = `SchemaType.ARRAY`

Defined in: [XmlArraySchema.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L16)

**`Internal`**

Schema type identifier

###### Overrides

`XmlSchemaBase.schemaType`

##### element

> `readonly` **element**: `T`

Defined in: [XmlArraySchema.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L19)

##### xpath?

> `readonly` `optional` **xpath**: `string`

Defined in: [XmlArraySchema.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L20)

##### \_output

> `readonly` **\_output**: `T`\[`"_output"`\][]

Defined in: [base.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L23)

###### Inherited from

`XmlSchemaBase._output`

##### \_input

> `readonly` **\_input**: `T`\[`"_input"`\][]

Defined in: [base.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L24)

###### Inherited from

`XmlSchemaBase._input`

##### writeConfig?

> `protected` `optional` **writeConfig**: `XmlElementWriteConfig`

Defined in: [base.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L36)

**`Internal`**

Writer configuration for this schema

###### Inherited from

`XmlSchemaBase.writeConfig`

##### \_createTransform()

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:250](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L250)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### NewOutput

`NewOutput`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### fn

(`value`) => `NewOutput`

###### Returns

`XmlSchemaBase`\<`NewOutput`, `Input`\>

###### Inherited from

`XmlSchemaBase._createTransform`

##### \_createOptional()

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

Defined in: [base.ts:251](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L251)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

###### Inherited from

`XmlSchemaBase._createOptional`

##### \_createArray()

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:252](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L252)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### xpath?

`string`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

###### Inherited from

`XmlSchemaBase._createArray`

#### Methods

##### \_parse()

> **\_parse**(`input`, `parseOptions?`): `T`\[`"_output"`\][]

Defined in: [XmlArraySchema.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L25)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string or sync iterator

###### parseOptions?

[`ParseOptions`](#parseoptions)

###### Returns

`T`\[`"_output"`\][]

Parsed output

###### Throws

If parsing fails

###### Overrides

`XmlSchemaBase._parse`

##### \_parseAsync()

> **\_parseAsync**(`input`, `parseOptions?`): `Promise`\<`T`\[`"_output"`\][]\>

Defined in: [XmlArraySchema.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L30)

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

`XmlSchemaBase._parseAsync`

##### \_parseFromPosition()

> **\_parseFromPosition**(`iterator`, `startEvent`, `startDepth`, `options?`, `stateMachine?`, `parentContext?`): `T`\[`"_output"`\][] \| `Promise`\<`T`\[`"_output"`\][]\>

Defined in: [XmlArraySchema.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L39)

**`Internal`**

Parse array from current iterator position (for nested array parsing)

###### Parameters

###### iterator

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### startEvent

`StartElementEvent`

###### startDepth

`number`

###### options?

[`ParseOptions`](#parseoptions)

###### stateMachine?

`XmlParsingStateMachine`

###### parentContext?

`unknown`

###### Returns

`T`\[`"_output"`\][] \| `Promise`\<`T`\[`"_output"`\][]\>

###### Overrides

`XmlSchemaBase._parseFromPosition`

##### \_parseText()

> **\_parseText**(`text`): `T`\[`"_output"`\][]

Defined in: [XmlArraySchema.ts:74](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L74)

**`Internal`**

Parse text content (used internally by parser)

###### Parameters

###### text

`string`

Text content

###### Returns

`T`\[`"_output"`\][]

Parsed output

###### Overrides

`XmlSchemaBase._parseText`

##### \_writeSync()

> **\_writeSync**(`data`, `options?`): `string`

Defined in: [XmlArraySchema.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L84)

**`Internal`**

Write array data to XML synchronously

###### Parameters

###### data

`T`\[`"_output"`\][]

###### options?

`XmlWriteOptions`

###### Returns

`string`

###### Overrides

`XmlSchemaBase._writeSync`

##### \_write()

> **\_write**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [XmlArraySchema.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L147)

**`Internal`**

Write array data to WritableStream asynchronously

###### Parameters

###### data

`T`\[`"_output"`\][]

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`void`\>

###### Overrides

`XmlSchemaBase._write`

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`T`\[`"_output"`\][]\>

Defined in: [base.ts:109](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L109)

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

`XmlSchemaBase.parse`

##### parseSync()

> **parseSync**(`input`, `options?`): `T`\[`"_output"`\][]

Defined in: [base.ts:120](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L120)

Parse XML synchronously (public API)

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`T`\[`"_output"`\][]

Parsed output

###### Throws

If parsing fails

###### Inherited from

`XmlSchemaBase.parseSync`

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`T`\[`"_output"`\][]\>\>

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

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

`XmlSchemaBase.safeParse`

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`T`\[`"_output"`\][]\>

Defined in: [base.ts:151](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L151)

Parse XML synchronously with error handling

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`T`\[`"_output"`\][]\>

Parse result with success flag

###### Inherited from

`XmlSchemaBase.safeParseSync`

##### transform()

> **transform**\<`NewOutput`\>(`fn`): `XmlSchemaBase`\<`NewOutput`, `T`\[`"_input"`\][]\>

Defined in: [base.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L171)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

`XmlSchemaBase`\<`NewOutput`, `T`\[`"_input"`\][]\>

New schema with transform applied

###### Inherited from

`XmlSchemaBase.transform`

##### optional()

> **optional**(): `XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\][], `undefined` \| `T`\[`"_input"`\][]\>

Defined in: [base.ts:179](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L179)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\][], `undefined` \| `T`\[`"_input"`\][]\>

New optional schema

###### Inherited from

`XmlSchemaBase.optional`

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`T`\[`"_output"`\][][], `T`\[`"_input"`\][][]\>

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\][][], `T`\[`"_input"`\][][]\>

New array schema

###### Inherited from

`XmlSchemaBase.array`

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:198](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L198)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`T`\[`"_output"`\][]

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

`XmlSchemaBase.write`

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`T`\[`"_output"`\][]

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

`XmlSchemaBase.writeToStream`

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:235](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L235)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`T`\[`"_output"`\][]

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`string`

XML string

###### Inherited from

`XmlSchemaBase.writeSync`

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

Configure writer settings for this schema

###### Parameters

###### config

`XmlElementWriteConfig`

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

`XmlSchemaBase.writer`

***

### XmlBuilder

Defined in: [XmlBuilder.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L13)

Builder API for creating XML schemas

#### Constructors

##### Constructor

> **new XmlBuilder**(): [`XmlBuilder`](#xmlbuilder)

###### Returns

[`XmlBuilder`](#xmlbuilder)

#### Methods

##### string()

> **string**(`xpath?`): [`XmlStringSchema`](#xmlstringschema)

Defined in: [XmlBuilder.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L19)

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

Defined in: [XmlBuilder.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L28)

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

Defined in: [XmlBuilder.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L38)

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

Defined in: [XmlBuilder.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L48)

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

Defined in: [XmlNumberSchema.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L15)

Schema for parsing XML number values

#### Extends

- [`XmlSchema`](#xmlschema)\<`number`, `number`\>

#### Constructors

##### Constructor

> **new XmlNumberSchema**(`options`): [`XmlNumberSchema`](#xmlnumberschema)

Defined in: [XmlNumberSchema.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L18)

###### Parameters

###### options

[`XmlNumberOptions`](#xmlnumberoptions) = `{}`

###### Returns

[`XmlNumberSchema`](#xmlnumberschema)

###### Overrides

[`XmlSchema`](#xmlschema).[`constructor`](#constructor-5)

#### Properties

##### schemaType

> `readonly` **schemaType**: `"NUMBER"` = `SchemaType.NUMBER`

Defined in: [XmlNumberSchema.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L16)

**`Internal`**

Schema type identifier

###### Overrides

[`XmlSchema`](#xmlschema).[`schemaType`](#schematype-4)

##### options

> **options**: [`XmlNumberOptions`](#xmlnumberoptions) = `{}`

Defined in: [XmlNumberSchema.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L18)

##### \_output

> `readonly` **\_output**: `number`

Defined in: [base.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L23)

###### Inherited from

[`XmlSchema`](#xmlschema).[`_output`](#_output-4)

##### \_input

> `readonly` **\_input**: `number`

Defined in: [base.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L24)

###### Inherited from

[`XmlSchema`](#xmlschema).[`_input`](#_input-4)

##### writeConfig?

> `protected` `optional` **writeConfig**: `XmlElementWriteConfig`

Defined in: [base.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L36)

**`Internal`**

Writer configuration for this schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`writeConfig`](#writeconfig-4)

##### \_createTransform()

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:250](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L250)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### NewOutput

`NewOutput`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### fn

(`value`) => `NewOutput`

###### Returns

`XmlSchemaBase`\<`NewOutput`, `Input`\>

###### Inherited from

[`XmlSchema`](#xmlschema).[`_createTransform`](#_createtransform-4)

##### \_createOptional()

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

Defined in: [base.ts:251](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L251)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

###### Inherited from

[`XmlSchema`](#xmlschema).[`_createOptional`](#_createoptional-4)

##### \_createArray()

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:252](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L252)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### xpath?

`string`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

###### Inherited from

[`XmlSchema`](#xmlschema).[`_createArray`](#_createarray-4)

#### Methods

##### \_parse()

> **\_parse**(`input`, `parseOptions?`): `number`

Defined in: [XmlNumberSchema.ts:22](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L22)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string or sync iterator

###### parseOptions?

[`ParseOptions`](#parseoptions)

###### Returns

`number`

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchema`](#xmlschema).[`_parse`](#_parse-8)

##### \_parseAsync()

> **\_parseAsync**(`input`, `parseOptions?`): `Promise`\<`number`\>

Defined in: [XmlNumberSchema.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L28)

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

[`XmlSchema`](#xmlschema).[`_parseAsync`](#_parseasync-8)

##### \_parseText()

> **\_parseText**(`text`): `number`

Defined in: [XmlNumberSchema.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L34)

**`Internal`**

Parse text content (used internally by parser)

###### Parameters

###### text

`string`

Text content

###### Returns

`number`

Parsed output

###### Overrides

[`XmlSchema`](#xmlschema).[`_parseText`](#_parsetext-8)

##### \_parseFromPosition()

> **\_parseFromPosition**(`iterator`, `startEvent`, `startDepth`, `options?`): `number` \| `Promise`\<`number`\>

Defined in: [XmlNumberSchema.ts:86](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L86)

**`Internal`**

Parse from current iterator position

###### Parameters

###### iterator

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### startEvent

`StartElementEvent`

###### startDepth

`number`

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`number` \| `Promise`\<`number`\>

###### Overrides

[`XmlSchema`](#xmlschema).[`_parseFromPosition`](#_parsefromposition-8)

##### xpath()

> **xpath**(`path`): [`XmlNumberSchema`](#xmlnumberschema)

Defined in: [XmlNumberSchema.ts:157](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L157)

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

Defined in: [XmlNumberSchema.ts:170](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L170)

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

Defined in: [XmlNumberSchema.ts:179](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L179)

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

Defined in: [XmlNumberSchema.ts:187](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L187)

Require integer value

###### Returns

[`XmlNumberSchema`](#xmlnumberschema)

New schema that only accepts integers

##### \_writeContent()

> **\_writeContent**(`data`, `options?`): `string`

Defined in: [XmlNumberSchema.ts:195](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L195)

**`Internal`**

Write raw content only (used inside object schema)

###### Parameters

###### data

`number`

###### options?

`XmlWriteOptions`

###### Returns

`string`

##### \_writeSync()

> **\_writeSync**(`data`, `options?`): `string`

Defined in: [XmlNumberSchema.ts:203](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L203)

**`Internal`**

Write number data to XML synchronously

###### Parameters

###### data

`number`

###### options?

`XmlWriteOptions`

###### Returns

`string`

###### Overrides

[`XmlSchema`](#xmlschema).[`_writeSync`](#_writesync-8)

##### \_write()

> **\_write**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [XmlNumberSchema.ts:266](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L266)

**`Internal`**

Write number data to WritableStream asynchronously

###### Parameters

###### data

`number`

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`void`\>

###### Overrides

[`XmlSchema`](#xmlschema).[`_write`](#_write-8)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`number`\>

Defined in: [base.ts:109](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L109)

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

[`XmlSchema`](#xmlschema).[`parse`](#parse-8)

##### parseSync()

> **parseSync**(`input`, `options?`): `number`

Defined in: [base.ts:120](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L120)

Parse XML synchronously (public API)

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`number`

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchema`](#xmlschema).[`parseSync`](#parsesync-8)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`number`\>\>

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

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

[`XmlSchema`](#xmlschema).[`safeParse`](#safeparse-8)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`number`\>

Defined in: [base.ts:151](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L151)

Parse XML synchronously with error handling

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`number`\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#xmlschema).[`safeParseSync`](#safeparsesync-8)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): `XmlSchemaBase`\<`NewOutput`, `number`\>

Defined in: [base.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L171)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

`XmlSchemaBase`\<`NewOutput`, `number`\>

New schema with transform applied

###### Inherited from

[`XmlSchema`](#xmlschema).[`transform`](#transform-8)

##### optional()

> **optional**(): `XmlSchemaBase`\<`undefined` \| `number`, `undefined` \| `number`\>

Defined in: [base.ts:179](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L179)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| `number`, `undefined` \| `number`\>

New optional schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`optional`](#optional-8)

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`number`[], `number`[]\>

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

`XmlSchemaBase`\<`number`[], `number`[]\>

New array schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`array`](#array-10)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:198](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L198)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`number`

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

[`XmlSchema`](#xmlschema).[`write`](#write-8)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`number`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`XmlSchema`](#xmlschema).[`writeToStream`](#writetostream-8)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:235](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L235)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`number`

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`string`

XML string

###### Inherited from

[`XmlSchema`](#xmlschema).[`writeSync`](#writesync-8)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

Configure writer settings for this schema

###### Parameters

###### config

`XmlElementWriteConfig`

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchema`](#xmlschema).[`writer`](#writer-8)

***

### XmlObjectSchema

Defined in: [XmlObjectSchema.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L57)

Schema for parsing XML object values

#### Extends

- [`XmlSchema`](#xmlschema)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>, `unknown`\>

#### Type Parameters

##### T

`T` *extends* [`XmlObjectShape`](#xmlobjectshape)

#### Constructors

##### Constructor

> **new XmlObjectSchema**\<`T`\>(`shape`, `options`): [`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

Defined in: [XmlObjectSchema.ts:60](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L60)

###### Parameters

###### shape

`T`

###### options

[`XmlObjectOptions`](#xmlobjectoptions) = `{}`

###### Returns

[`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

###### Overrides

[`XmlSchema`](#xmlschema).[`constructor`](#constructor-5)

#### Properties

##### schemaType

> `readonly` **schemaType**: `"OBJECT"` = `SchemaType.OBJECT`

Defined in: [XmlObjectSchema.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L58)

**`Internal`**

Schema type identifier

###### Overrides

[`XmlSchema`](#xmlschema).[`schemaType`](#schematype-4)

##### shape

> `readonly` **shape**: `T`

Defined in: [XmlObjectSchema.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L61)

##### options

> **options**: [`XmlObjectOptions`](#xmlobjectoptions) = `{}`

Defined in: [XmlObjectSchema.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L62)

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [base.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L23)

###### Inherited from

[`XmlSchema`](#xmlschema).[`_output`](#_output-4)

##### \_input

> `readonly` **\_input**: `unknown`

Defined in: [base.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L24)

###### Inherited from

[`XmlSchema`](#xmlschema).[`_input`](#_input-4)

##### writeConfig?

> `protected` `optional` **writeConfig**: `XmlElementWriteConfig`

Defined in: [base.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L36)

**`Internal`**

Writer configuration for this schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`writeConfig`](#writeconfig-4)

##### \_createTransform()

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:250](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L250)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### NewOutput

`NewOutput`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### fn

(`value`) => `NewOutput`

###### Returns

`XmlSchemaBase`\<`NewOutput`, `Input`\>

###### Inherited from

[`XmlSchema`](#xmlschema).[`_createTransform`](#_createtransform-4)

##### \_createOptional()

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

Defined in: [base.ts:251](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L251)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

###### Inherited from

[`XmlSchema`](#xmlschema).[`_createOptional`](#_createoptional-4)

##### \_createArray()

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:252](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L252)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### xpath?

`string`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

###### Inherited from

[`XmlSchema`](#xmlschema).[`_createArray`](#_createarray-4)

#### Methods

##### \_parse()

> **\_parse**(`input`, `parseOptions?`): [`InferObjectOutput`](#inferobjectoutput)\<`T`\>

Defined in: [XmlObjectSchema.ts:67](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L67)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string or sync iterator

###### parseOptions?

[`ParseOptions`](#parseoptions)

###### Returns

[`InferObjectOutput`](#inferobjectoutput)\<`T`\>

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchema`](#xmlschema).[`_parse`](#_parse-8)

##### \_parseAsync()

> **\_parseAsync**(`input`, `parseOptions?`): `Promise`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Defined in: [XmlObjectSchema.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L72)

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

[`XmlSchema`](#xmlschema).[`_parseAsync`](#_parseasync-8)

##### \_parseFromPosition()

> **\_parseFromPosition**(`iterator`, `startEvent`, `startDepth`, `options?`, `stateMachine?`, `parentContext?`): [`InferObjectOutput`](#inferobjectoutput)\<`T`\> \| `Promise`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Defined in: [XmlObjectSchema.ts:81](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L81)

**`Internal`**

Parse from current iterator position (for recursive/streaming parsing)

###### Parameters

###### iterator

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### startEvent

`StartElementEvent`

###### startDepth

`number`

###### options?

[`ParseOptions`](#parseoptions)

###### stateMachine?

`XmlParsingStateMachine`

###### parentContext?

`SchemaActivation`

###### Returns

[`InferObjectOutput`](#inferobjectoutput)\<`T`\> \| `Promise`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

###### Overrides

[`XmlSchema`](#xmlschema).[`_parseFromPosition`](#_parsefromposition-8)

##### \_parseText()

> **\_parseText**(`text`): [`InferObjectOutput`](#inferobjectoutput)\<`T`\>

Defined in: [XmlObjectSchema.ts:141](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L141)

**`Internal`**

Parse text content (used internally by parser)

###### Parameters

###### text

`string`

Text content

###### Returns

[`InferObjectOutput`](#inferobjectoutput)\<`T`\>

Parsed output

###### Overrides

[`XmlSchema`](#xmlschema).[`_parseText`](#_parsetext-8)

##### xpath()

> **xpath**(`path`): [`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

Defined in: [XmlObjectSchema.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L152)

Set XPath expression for locating the object

###### Parameters

###### path

`string`

XPath expression

###### Returns

[`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

New schema with XPath

##### \_writeContent()

> **\_writeContent**(`data`, `options?`): `string`

Defined in: [XmlObjectSchema.ts:164](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L164)

**`Internal`**

Write raw content only (used inside parent object/array schema)

###### Parameters

###### data

[`InferObjectOutput`](#inferobjectoutput)\<`T`\>

###### options?

`XmlWriteOptions`

###### Returns

`string`

##### \_writeSync()

> **\_writeSync**(`data`, `options?`): `string`

Defined in: [XmlObjectSchema.ts:193](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L193)

**`Internal`**

Write object data to XML synchronously

###### Parameters

###### data

[`InferObjectOutput`](#inferobjectoutput)\<`T`\>

###### options?

`XmlWriteOptions`

###### Returns

`string`

###### Overrides

[`XmlSchema`](#xmlschema).[`_writeSync`](#_writesync-8)

##### \_write()

> **\_write**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [XmlObjectSchema.ts:307](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L307)

**`Internal`**

Write object data to WritableStream asynchronously

###### Parameters

###### data

[`InferObjectOutput`](#inferobjectoutput)\<`T`\>

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`void`\>

###### Overrides

[`XmlSchema`](#xmlschema).[`_write`](#_write-8)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Defined in: [base.ts:109](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L109)

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

[`XmlSchema`](#xmlschema).[`parse`](#parse-8)

##### parseSync()

> **parseSync**(`input`, `options?`): `Output`

Defined in: [base.ts:120](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L120)

Parse XML synchronously (public API)

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output`

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchema`](#xmlschema).[`parseSync`](#parsesync-8)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>\>

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

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

[`XmlSchema`](#xmlschema).[`safeParse`](#safeparse-8)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Defined in: [base.ts:151](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L151)

Parse XML synchronously with error handling

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#xmlschema).[`safeParseSync`](#safeparsesync-8)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): `XmlSchemaBase`\<`NewOutput`, `unknown`\>

Defined in: [base.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L171)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

`XmlSchemaBase`\<`NewOutput`, `unknown`\>

New schema with transform applied

###### Inherited from

[`XmlSchema`](#xmlschema).[`transform`](#transform-8)

##### optional()

> **optional**(): `XmlSchemaBase`\<`undefined` \| [`InferObjectOutput`](#inferobjectoutput)\<`T`\>, `unknown`\>

Defined in: [base.ts:179](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L179)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| [`InferObjectOutput`](#inferobjectoutput)\<`T`\>, `unknown`\>

New optional schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`optional`](#optional-8)

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>[], `unknown`[]\>

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

`XmlSchemaBase`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>[], `unknown`[]\>

New array schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`array`](#array-10)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:198](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L198)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

[`XmlSchema`](#xmlschema).[`write`](#write-8)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`XmlSchema`](#xmlschema).[`writeToStream`](#writetostream-8)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:235](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L235)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`string`

XML string

###### Inherited from

[`XmlSchema`](#xmlschema).[`writeSync`](#writesync-8)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

Configure writer settings for this schema

###### Parameters

###### config

`XmlElementWriteConfig`

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchema`](#xmlschema).[`writer`](#writer-8)

***

### XmlOptionalSchema

Defined in: [XmlOptionalSchema.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L10)

Schema for optional values

#### Extends

- `XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

#### Type Parameters

##### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

#### Constructors

##### Constructor

> **new XmlOptionalSchema**\<`T`\>(`schema`): [`XmlOptionalSchema`](#xmloptionalschema)\<`T`\>

Defined in: [XmlOptionalSchema.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L13)

###### Parameters

###### schema

`T`

###### Returns

[`XmlOptionalSchema`](#xmloptionalschema)\<`T`\>

###### Overrides

XmlSchemaBase\<T\['\_output'\] \| undefined, T\['\_input'\] \| undefined\>.constructor

#### Properties

##### schemaType

> `readonly` **schemaType**: `"OPTIONAL"` = `SchemaType.OPTIONAL`

Defined in: [XmlOptionalSchema.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L11)

**`Internal`**

Schema type identifier

###### Overrides

`XmlSchemaBase.schemaType`

##### schema

> `readonly` **schema**: `T`

Defined in: [XmlOptionalSchema.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L13)

##### \_output

> `readonly` **\_output**: `undefined` \| `T`\[`"_output"`\]

Defined in: [base.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L23)

###### Inherited from

`XmlSchemaBase._output`

##### \_input

> `readonly` **\_input**: `undefined` \| `T`\[`"_input"`\]

Defined in: [base.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L24)

###### Inherited from

`XmlSchemaBase._input`

##### writeConfig?

> `protected` `optional` **writeConfig**: `XmlElementWriteConfig`

Defined in: [base.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L36)

**`Internal`**

Writer configuration for this schema

###### Inherited from

`XmlSchemaBase.writeConfig`

##### \_createTransform()

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:250](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L250)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### NewOutput

`NewOutput`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### fn

(`value`) => `NewOutput`

###### Returns

`XmlSchemaBase`\<`NewOutput`, `Input`\>

###### Inherited from

`XmlSchemaBase._createTransform`

##### \_createOptional()

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

Defined in: [base.ts:251](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L251)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

###### Inherited from

`XmlSchemaBase._createOptional`

##### \_createArray()

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:252](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L252)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### xpath?

`string`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

###### Inherited from

`XmlSchemaBase._createArray`

#### Methods

##### \_parse()

> **\_parse**(`input`, `options?`): `undefined` \| `T`\[`"_output"`\]

Defined in: [XmlOptionalSchema.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L17)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`undefined` \| `T`\[`"_output"`\]

Parsed output

###### Throws

If parsing fails

###### Overrides

`XmlSchemaBase._parse`

##### \_parseAsync()

> **\_parseAsync**(`input`, `options?`): `Promise`\<`undefined` \| `T`\[`"_output"`\]\>

Defined in: [XmlOptionalSchema.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L30)

Parse XML input asynchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`undefined` \| `T`\[`"_output"`\]\>

Parsed output

###### Throws

If parsing fails

###### Overrides

`XmlSchemaBase._parseAsync`

##### \_parseText()

> **\_parseText**(`text`): `undefined` \| `T`\[`"_output"`\]

Defined in: [XmlOptionalSchema.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L43)

**`Internal`**

Parse text content (used internally by parser)

###### Parameters

###### text

`string`

Text content

###### Returns

`undefined` \| `T`\[`"_output"`\]

Parsed output

###### Overrides

`XmlSchemaBase._parseText`

##### \_writeSync()

> **\_writeSync**(`data`, `options?`): `string`

Defined in: [XmlOptionalSchema.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L63)

**`Internal`**

Write optional data to XML synchronously

###### Parameters

###### data

`undefined` | `T`\[`"_output"`\]

###### options?

`XmlWriteOptions`

###### Returns

`string`

###### Overrides

`XmlSchemaBase._writeSync`

##### \_write()

> **\_write**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [XmlOptionalSchema.ts:74](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L74)

**`Internal`**

Write optional data to WritableStream asynchronously

###### Parameters

###### data

`undefined` | `T`\[`"_output"`\]

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`void`\>

###### Overrides

`XmlSchemaBase._write`

##### \_parseFromPosition()?

> `optional` **\_parseFromPosition**(`iterator`, `startEvent`, `startDepth`, `options?`): `undefined` \| `T`\[`"_output"`\] \| `Promise`\<`undefined` \| `T`\[`"_output"`\]\>

Defined in: [base.ts:95](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L95)

**`Internal`**

Parse from current iterator position (for streaming/recursive parsing)

###### Parameters

###### iterator

Event iterator at current position

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### startEvent

`StartElementEvent`

The start element event

###### startDepth

`number`

Depth of the start element

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`undefined` \| `T`\[`"_output"`\] \| `Promise`\<`undefined` \| `T`\[`"_output"`\]\>

Parsed output

###### Inherited from

`XmlSchemaBase._parseFromPosition`

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`undefined` \| `T`\[`"_output"`\]\>

Defined in: [base.ts:109](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L109)

Parse XML asynchronously (public API)

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<`undefined` \| `T`\[`"_output"`\]\>

Parsed output

###### Throws

If parsing fails

###### Inherited from

`XmlSchemaBase.parse`

##### parseSync()

> **parseSync**(`input`, `options?`): `undefined` \| `T`\[`"_output"`\]

Defined in: [base.ts:120](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L120)

Parse XML synchronously (public API)

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`undefined` \| `T`\[`"_output"`\]

Parsed output

###### Throws

If parsing fails

###### Inherited from

`XmlSchemaBase.parseSync`

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`undefined` \| `T`\[`"_output"`\]\>\>

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

Parse XML asynchronously with error handling

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string, stream, or async iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Promise`\<[`ParseResult`](#parseresult)\<`undefined` \| `T`\[`"_output"`\]\>\>

Parse result with success flag

###### Inherited from

`XmlSchemaBase.safeParse`

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`undefined` \| `T`\[`"_output"`\]\>

Defined in: [base.ts:151](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L151)

Parse XML synchronously with error handling

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`undefined` \| `T`\[`"_output"`\]\>

Parse result with success flag

###### Inherited from

`XmlSchemaBase.safeParseSync`

##### transform()

> **transform**\<`NewOutput`\>(`fn`): `XmlSchemaBase`\<`NewOutput`, `undefined` \| `T`\[`"_input"`\]\>

Defined in: [base.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L171)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

`XmlSchemaBase`\<`NewOutput`, `undefined` \| `T`\[`"_input"`\]\>

New schema with transform applied

###### Inherited from

`XmlSchemaBase.transform`

##### optional()

> **optional**(): `XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

Defined in: [base.ts:179](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L179)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

New optional schema

###### Inherited from

`XmlSchemaBase.optional`

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<(`undefined` \| `T`\[`"_output"`\])[], (`undefined` \| `T`\[`"_input"`\])[]\>

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

`XmlSchemaBase`\<(`undefined` \| `T`\[`"_output"`\])[], (`undefined` \| `T`\[`"_input"`\])[]\>

New array schema

###### Inherited from

`XmlSchemaBase.array`

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:198](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L198)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

Data to write

`undefined` | `T`\[`"_output"`\]

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

`XmlSchemaBase.write`

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

Data to write

`undefined` | `T`\[`"_output"`\]

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

`XmlSchemaBase.writeToStream`

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:235](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L235)

Write data to XML string synchronously (public API)

###### Parameters

###### data

Data to write

`undefined` | `T`\[`"_output"`\]

###### options?

`XmlWriteOptions`

Write options

###### Returns

`string`

XML string

###### Inherited from

`XmlSchemaBase.writeSync`

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

Configure writer settings for this schema

###### Parameters

###### config

`XmlElementWriteConfig`

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

`XmlSchemaBase.writer`

***

### `abstract` XmlSchema

Defined in: [XmlSchema.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlSchema.ts#L10)

Main XML schema class (extends XmlSchemaBase with all methods)

#### Extends

- `XmlSchemaBase`\<`Output`, `Input`\>

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

> **new XmlSchema**\<`Output`, `Input`\>(): [`XmlSchema`](#xmlschema)\<`Output`, `Input`\>

###### Returns

[`XmlSchema`](#xmlschema)\<`Output`, `Input`\>

###### Inherited from

`XmlSchemaBase<Output, Input>.constructor`

#### Properties

##### \_createTransform()

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:250](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L250)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### NewOutput

`NewOutput`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### fn

(`value`) => `NewOutput`

###### Returns

`XmlSchemaBase`\<`NewOutput`, `Input`\>

###### Inherited from

`XmlSchemaBase._createTransform`

##### \_createOptional()

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

Defined in: [base.ts:251](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L251)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

###### Inherited from

`XmlSchemaBase._createOptional`

##### \_createArray()

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:252](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L252)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### xpath?

`string`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

###### Inherited from

`XmlSchemaBase._createArray`

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [base.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L23)

###### Inherited from

`XmlSchemaBase._output`

##### \_input

> `readonly` **\_input**: `Input`

Defined in: [base.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L24)

###### Inherited from

`XmlSchemaBase._input`

##### schemaType

> `abstract` `readonly` **schemaType**: `SchemaType`

Defined in: [base.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L30)

**`Internal`**

Schema type identifier

###### Inherited from

`XmlSchemaBase.schemaType`

##### writeConfig?

> `protected` `optional` **writeConfig**: `XmlElementWriteConfig`

Defined in: [base.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L36)

**`Internal`**

Writer configuration for this schema

###### Inherited from

[`XmlStringSchema`](#xmlstringschema).[`writeConfig`](#writeconfig-5)

#### Methods

##### \_parse()

> `abstract` **\_parse**(`input`, `options?`): `Output`

Defined in: [base.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L45)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

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

`XmlSchemaBase._parse`

##### \_parseAsync()

> `abstract` **\_parseAsync**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [base.ts:54](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L54)

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

`XmlSchemaBase._parseAsync`

##### \_writeSync()

> `abstract` **\_writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L63)

**`Internal`**

Write data to XML string synchronously

###### Parameters

###### data

`Output`

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`string`

XML string

###### Inherited from

`XmlSchemaBase._writeSync`

##### \_write()

> `abstract` **\_write**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L72)

**`Internal`**

Write data to WritableStream asynchronously

###### Parameters

###### data

`Output`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

`XmlSchemaBase._write`

##### \_parseText()?

> `abstract` `optional` **\_parseText**(`text`): `Output`

Defined in: [base.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L84)

**`Internal`**

Parse text content (used internally by parser)

###### Parameters

###### text

`string`

Text content

###### Returns

`Output`

Parsed output

###### Inherited from

`XmlSchemaBase._parseText`

##### \_parseFromPosition()?

> `optional` **\_parseFromPosition**(`iterator`, `startEvent`, `startDepth`, `options?`): `Output` \| `Promise`\<`Output`\>

Defined in: [base.ts:95](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L95)

**`Internal`**

Parse from current iterator position (for streaming/recursive parsing)

###### Parameters

###### iterator

Event iterator at current position

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### startEvent

`StartElementEvent`

The start element event

###### startDepth

`number`

Depth of the start element

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output` \| `Promise`\<`Output`\>

Parsed output

###### Inherited from

`XmlSchemaBase._parseFromPosition`

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [base.ts:109](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L109)

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

`XmlSchemaBase.parse`

##### parseSync()

> **parseSync**(`input`, `options?`): `Output`

Defined in: [base.ts:120](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L120)

Parse XML synchronously (public API)

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output`

Parsed output

###### Throws

If parsing fails

###### Inherited from

`XmlSchemaBase.parseSync`

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

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

`XmlSchemaBase.safeParse`

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`Output`\>

Defined in: [base.ts:151](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L151)

Parse XML synchronously with error handling

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`Output`\>

Parse result with success flag

###### Inherited from

`XmlSchemaBase.safeParseSync`

##### transform()

> **transform**\<`NewOutput`\>(`fn`): `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L171)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

`XmlSchemaBase`\<`NewOutput`, `Input`\>

New schema with transform applied

###### Inherited from

`XmlSchemaBase.transform`

##### optional()

> **optional**(): `XmlSchemaBase`\<`undefined` \| `Output`, `undefined` \| `Input`\>

Defined in: [base.ts:179](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L179)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| `Output`, `undefined` \| `Input`\>

New optional schema

###### Inherited from

`XmlSchemaBase.optional`

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`Output`[], `Input`[]\>

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

`XmlSchemaBase`\<`Output`[], `Input`[]\>

New array schema

###### Inherited from

`XmlSchemaBase.array`

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:198](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L198)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

`XmlSchemaBase.write`

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

`XmlSchemaBase.writeToStream`

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:235](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L235)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`string`

XML string

###### Inherited from

`XmlSchemaBase.writeSync`

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

Configure writer settings for this schema

###### Parameters

###### config

`XmlElementWriteConfig`

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

`XmlSchemaBase.writer`

***

### XmlStringSchema

Defined in: [XmlStringSchema.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L26)

Schema for parsing XML string values

#### Extends

- [`XmlSchema`](#xmlschema)\<`string`, `string`\>

#### Constructors

##### Constructor

> **new XmlStringSchema**(`options`): [`XmlStringSchema`](#xmlstringschema)

Defined in: [XmlStringSchema.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L29)

###### Parameters

###### options

[`XmlStringOptions`](#xmlstringoptions) = `{}`

###### Returns

[`XmlStringSchema`](#xmlstringschema)

###### Overrides

[`XmlSchema`](#xmlschema).[`constructor`](#constructor-5)

#### Properties

##### schemaType

> `readonly` **schemaType**: `"STRING"` = `SchemaType.STRING`

Defined in: [XmlStringSchema.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L27)

**`Internal`**

Schema type identifier

###### Overrides

[`XmlSchema`](#xmlschema).[`schemaType`](#schematype-4)

##### options

> **options**: [`XmlStringOptions`](#xmlstringoptions) = `{}`

Defined in: [XmlStringSchema.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L29)

##### \_output

> `readonly` **\_output**: `string`

Defined in: [base.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L23)

###### Inherited from

[`XmlSchema`](#xmlschema).[`_output`](#_output-4)

##### \_input

> `readonly` **\_input**: `string`

Defined in: [base.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L24)

###### Inherited from

[`XmlSchema`](#xmlschema).[`_input`](#_input-4)

##### writeConfig?

> `protected` `optional` **writeConfig**: `XmlElementWriteConfig`

Defined in: [base.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L36)

**`Internal`**

Writer configuration for this schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`writeConfig`](#writeconfig-4)

##### \_createTransform()

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:250](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L250)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### NewOutput

`NewOutput`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### fn

(`value`) => `NewOutput`

###### Returns

`XmlSchemaBase`\<`NewOutput`, `Input`\>

###### Inherited from

[`XmlSchema`](#xmlschema).[`_createTransform`](#_createtransform-4)

##### \_createOptional()

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

Defined in: [base.ts:251](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L251)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

###### Inherited from

[`XmlSchema`](#xmlschema).[`_createOptional`](#_createoptional-4)

##### \_createArray()

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:252](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L252)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### xpath?

`string`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

###### Inherited from

[`XmlSchema`](#xmlschema).[`_createArray`](#_createarray-4)

#### Methods

##### \_parse()

> **\_parse**(`input`, `parseOptions?`): `string`

Defined in: [XmlStringSchema.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L33)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string or sync iterator

###### parseOptions?

[`ParseOptions`](#parseoptions)

###### Returns

`string`

Parsed output

###### Throws

If parsing fails

###### Overrides

[`XmlSchema`](#xmlschema).[`_parse`](#_parse-8)

##### \_parseAsync()

> **\_parseAsync**(`input`, `parseOptions?`): `Promise`\<`string`\>

Defined in: [XmlStringSchema.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L38)

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

[`XmlSchema`](#xmlschema).[`_parseAsync`](#_parseasync-8)

##### \_parseText()

> **\_parseText**(`text`): `string`

Defined in: [XmlStringSchema.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L43)

**`Internal`**

Parse text content (used internally by parser)

###### Parameters

###### text

`string`

Text content

###### Returns

`string`

Parsed output

###### Overrides

[`XmlSchema`](#xmlschema).[`_parseText`](#_parsetext-8)

##### \_parseFromPosition()

> **\_parseFromPosition**(`iterator`, `startEvent`, `startDepth`, `options?`): `string` \| `Promise`\<`string`\>

Defined in: [XmlStringSchema.ts:51](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L51)

**`Internal`**

Parse from current iterator position

###### Parameters

###### iterator

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### startEvent

`StartElementEvent`

###### startDepth

`number`

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`string` \| `Promise`\<`string`\>

###### Overrides

[`XmlSchema`](#xmlschema).[`_parseFromPosition`](#_parsefromposition-8)

##### xpath()

> **xpath**(`path`): [`XmlStringSchema`](#xmlstringschema)

Defined in: [XmlStringSchema.ts:122](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L122)

Set XPath expression for locating the element

###### Parameters

###### path

`string`

XPath expression

###### Returns

[`XmlStringSchema`](#xmlstringschema)

New schema with XPath

##### \_writeContent()

> **\_writeContent**(`data`, `options?`): `string`

Defined in: [XmlStringSchema.ts:134](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L134)

**`Internal`**

Write raw content only (used inside object schema)

###### Parameters

###### data

`string`

###### options?

`XmlWriteOptions`

###### Returns

`string`

##### \_writeSync()

> **\_writeSync**(`data`, `options?`): `string`

Defined in: [XmlStringSchema.ts:142](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L142)

**`Internal`**

Write string data to XML synchronously

###### Parameters

###### data

`string`

###### options?

`XmlWriteOptions`

###### Returns

`string`

###### Overrides

[`XmlSchema`](#xmlschema).[`_writeSync`](#_writesync-8)

##### \_write()

> **\_write**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [XmlStringSchema.ts:210](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L210)

**`Internal`**

Write string data to WritableStream asynchronously

###### Parameters

###### data

`string`

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`void`\>

###### Overrides

[`XmlSchema`](#xmlschema).[`_write`](#_write-8)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:109](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L109)

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

[`XmlSchema`](#xmlschema).[`parse`](#parse-8)

##### parseSync()

> **parseSync**(`input`, `options?`): `string`

Defined in: [base.ts:120](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L120)

Parse XML synchronously (public API)

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`string`

Parsed output

###### Throws

If parsing fails

###### Inherited from

[`XmlSchema`](#xmlschema).[`parseSync`](#parsesync-8)

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`string`\>\>

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

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

[`XmlSchema`](#xmlschema).[`safeParse`](#safeparse-8)

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`string`\>

Defined in: [base.ts:151](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L151)

Parse XML synchronously with error handling

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`string`\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#xmlschema).[`safeParseSync`](#safeparsesync-8)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): `XmlSchemaBase`\<`NewOutput`, `string`\>

Defined in: [base.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L171)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

`XmlSchemaBase`\<`NewOutput`, `string`\>

New schema with transform applied

###### Inherited from

[`XmlSchema`](#xmlschema).[`transform`](#transform-8)

##### optional()

> **optional**(): `XmlSchemaBase`\<`undefined` \| `string`, `undefined` \| `string`\>

Defined in: [base.ts:179](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L179)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| `string`, `undefined` \| `string`\>

New optional schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`optional`](#optional-8)

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`string`[], `string`[]\>

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

`XmlSchemaBase`\<`string`[], `string`[]\>

New array schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`array`](#array-10)

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:198](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L198)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`string`

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

[`XmlSchema`](#xmlschema).[`write`](#write-8)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`string`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`XmlSchema`](#xmlschema).[`writeToStream`](#writetostream-8)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:235](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L235)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`string`

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`string`

XML string

###### Inherited from

[`XmlSchema`](#xmlschema).[`writeSync`](#writesync-8)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

Configure writer settings for this schema

###### Parameters

###### config

`XmlElementWriteConfig`

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchema`](#xmlschema).[`writer`](#writer-8)

***

### XmlTransformSchema

Defined in: [XmlTransformSchema.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L11)

Schema for transforming parsed values

#### Extends

- `XmlSchemaBase`\<`Output`, `Input`\>

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

Defined in: [XmlTransformSchema.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L19)

###### Parameters

###### schema

`XmlSchemaBase`\<`IntermediateOutput`, `Input`\>

###### transformFn

(`value`) => `Output`

###### Returns

[`XmlTransformSchema`](#xmltransformschema)\<`Output`, `Input`, `IntermediateOutput`\>

###### Overrides

`XmlSchemaBase<Output, Input>.constructor`

#### Properties

##### schemaType

> `readonly` **schemaType**: `"TRANSFORM"` = `SchemaType.TRANSFORM`

Defined in: [XmlTransformSchema.ts:12](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L12)

**`Internal`**

Schema type identifier

###### Overrides

`XmlSchemaBase.schemaType`

##### schema

> `readonly` **schema**: `XmlSchemaBase`\<`IntermediateOutput`, `Input`\>

Defined in: [XmlTransformSchema.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L15)

**`Internal`**

##### transformFn()

> `readonly` **transformFn**: (`value`) => `Output`

Defined in: [XmlTransformSchema.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L17)

**`Internal`**

###### Parameters

###### value

`IntermediateOutput`

###### Returns

`Output`

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [base.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L23)

###### Inherited from

`XmlSchemaBase._output`

##### \_input

> `readonly` **\_input**: `Input`

Defined in: [base.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L24)

###### Inherited from

`XmlSchemaBase._input`

##### writeConfig?

> `protected` `optional` **writeConfig**: `XmlElementWriteConfig`

Defined in: [base.ts:36](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L36)

**`Internal`**

Writer configuration for this schema

###### Inherited from

`XmlSchemaBase.writeConfig`

##### \_createTransform()

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:250](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L250)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### NewOutput

`NewOutput`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### fn

(`value`) => `NewOutput`

###### Returns

`XmlSchemaBase`\<`NewOutput`, `Input`\>

###### Inherited from

`XmlSchemaBase._createTransform`

##### \_createOptional()

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

Defined in: [base.ts:251](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L251)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

###### Inherited from

`XmlSchemaBase._createOptional`

##### \_createArray()

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:252](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L252)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### xpath?

`string`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

###### Inherited from

`XmlSchemaBase._createArray`

#### Methods

##### \_parse()

> **\_parse**(`input`, `options?`): `Output`

Defined in: [XmlTransformSchema.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L28)

Parse XML input synchronously

###### Parameters

###### input

[`ParseInput`](#parseinput)

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output`

Parsed output

###### Throws

If parsing fails

###### Overrides

`XmlSchemaBase._parse`

##### \_parseAsync()

> **\_parseAsync**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [XmlTransformSchema.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L33)

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

`XmlSchemaBase._parseAsync`

##### \_parseFromPosition()

> **\_parseFromPosition**(`iterator`, `startEvent`, `startDepth`, `options?`): `Output` \| `Promise`\<`Output`\>

Defined in: [XmlTransformSchema.ts:42](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L42)

**`Internal`**

Parse from current iterator position and apply transform

###### Parameters

###### iterator

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### startEvent

`StartElementEvent`

###### startDepth

`number`

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`Output` \| `Promise`\<`Output`\>

###### Overrides

`XmlSchemaBase._parseFromPosition`

##### \_parseText()

> **\_parseText**(`text`): `Output`

Defined in: [XmlTransformSchema.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L63)

**`Internal`**

Parse text content (used internally by parser)

###### Parameters

###### text

`string`

Text content

###### Returns

`Output`

Parsed output

###### Overrides

`XmlSchemaBase._parseText`

##### \_writeSync()

> **\_writeSync**(`data`, `options?`): `string`

Defined in: [XmlTransformSchema.ts:76](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L76)

**`Internal`**

Write transformed data to XML synchronously
Note: Transform is not reversible, so writing is not supported

###### Parameters

###### data

`Output`

###### options?

`XmlWriteOptions`

###### Returns

`string`

###### Overrides

`XmlSchemaBase._writeSync`

##### \_write()

> **\_write**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [XmlTransformSchema.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L85)

**`Internal`**

Write transformed data to WritableStream asynchronously
Note: Transform is not reversible, so writing is not supported

###### Parameters

###### data

`Output`

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`void`\>

###### Overrides

`XmlSchemaBase._write`

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [base.ts:109](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L109)

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

`XmlSchemaBase.parse`

##### parseSync()

> **parseSync**(`input`, `options?`): `Output`

Defined in: [base.ts:120](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L120)

Parse XML synchronously (public API)

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

`Output`

Parsed output

###### Throws

If parsing fails

###### Inherited from

`XmlSchemaBase.parseSync`

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

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

`XmlSchemaBase.safeParse`

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`Output`\>

Defined in: [base.ts:151](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L151)

Parse XML synchronously with error handling

###### Parameters

###### input

XML string or sync iterator

`string` | `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`Output`\>

Parse result with success flag

###### Inherited from

`XmlSchemaBase.safeParseSync`

##### transform()

> **transform**\<`NewOutput`\>(`fn`): `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L171)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

`XmlSchemaBase`\<`NewOutput`, `Input`\>

New schema with transform applied

###### Inherited from

`XmlSchemaBase.transform`

##### optional()

> **optional**(): `XmlSchemaBase`\<`undefined` \| `Output`, `undefined` \| `Input`\>

Defined in: [base.ts:179](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L179)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| `Output`, `undefined` \| `Input`\>

New optional schema

###### Inherited from

`XmlSchemaBase.optional`

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`Output`[], `Input`[]\>

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

`XmlSchemaBase`\<`Output`[], `Input`[]\>

New array schema

###### Inherited from

`XmlSchemaBase.array`

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:198](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L198)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`string`\>

XML string

###### Inherited from

`XmlSchemaBase.write`

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Writable stream to write to

###### options?

`XmlWriteOptions`

Write options

###### Returns

`Promise`\<`void`\>

###### Inherited from

`XmlSchemaBase.writeToStream`

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:235](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L235)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`Output`

Data to write

###### options?

`XmlWriteOptions`

Write options

###### Returns

`string`

XML string

###### Inherited from

`XmlSchemaBase.writeSync`

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

Configure writer settings for this schema

###### Parameters

###### config

`XmlElementWriteConfig`

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

`XmlSchemaBase.writer`

***

### XmlParseError

Defined in: [errors.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/errors.ts#L6)

XML parse error with detailed issue information

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new XmlParseError**(`issues`): [`XmlParseError`](#xmlparseerror)

Defined in: [errors.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/errors.ts#L16)

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

Defined in: [errors.ts:10](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/errors.ts#L10)

List of validation issues

###### path

> **path**: `string`[]

###### message

> **message**: `string`

###### code

> **code**: `string`

## Interfaces

### ParseOptions

Defined in: [types.ts:9](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L9)

Parse options for XML converter

#### Properties

##### trimText?

> `optional` **trimText**: `boolean`

Defined in: [types.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L14)

Whether to trim whitespace from text content

###### Default Value

```ts
false
```

##### decodeEntities?

> `optional` **decodeEntities**: `boolean`

Defined in: [types.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L20)

Whether to decode XML entities

###### Default Value

```ts
true
```

##### strict?

> `optional` **strict**: `boolean`

Defined in: [types.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L26)

Strict mode for parsing

###### Default Value

```ts
false
```

##### maxDepth?

> `optional` **maxDepth**: `number`

Defined in: [types.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L32)

Maximum XML depth

###### Default Value

```ts
1000
```

##### maxEvents?

> `optional` **maxEvents**: `number`

Defined in: [types.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L38)

Maximum number of events to process

###### Default Value

```ts
1000000
```

***

### XmlStringOptions

Defined in: [types.ts:46](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L46)

Options for string schema

#### Properties

##### xpath?

> `optional` **xpath**: `string`

Defined in: [types.ts:50](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L50)

XPath expression to locate the element

##### min?

> `optional` **min**: `number`

Defined in: [types.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L55)

Minimum string length

##### max?

> `optional` **max**: `number`

Defined in: [types.ts:60](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L60)

Maximum string length

##### pattern?

> `optional` **pattern**: `RegExp`

Defined in: [types.ts:65](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L65)

Regular expression pattern to validate against

***

### XmlNumberOptions

Defined in: [types.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L73)

Options for number schema

#### Properties

##### xpath?

> `optional` **xpath**: `string`

Defined in: [types.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L77)

XPath expression to locate the element

##### min?

> `optional` **min**: `number`

Defined in: [types.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L82)

Minimum value

##### max?

> `optional` **max**: `number`

Defined in: [types.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L87)

Maximum value

##### int?

> `optional` **int**: `boolean`

Defined in: [types.ts:93](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L93)

Whether the number must be an integer

###### Default Value

```ts
false
```

***

### XmlObjectOptions

Defined in: [types.ts:101](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L101)

Options for object schema

#### Properties

##### xpath?

> `optional` **xpath**: `string`

Defined in: [types.ts:105](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L105)

XPath expression to locate the element

##### strict?

> `optional` **strict**: `boolean`

Defined in: [types.ts:111](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L111)

Strict mode - reject unknown properties

###### Default Value

```ts
false
```

## Type Aliases

### XmlObjectShape

> **XmlObjectShape** = `Record`\<`string`, [`XmlSchema`](#xmlschema)\<`unknown`, `unknown`\>\>

Defined in: [XmlObjectSchema.ts:41](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L41)

Shape type for object schema

***

### InferObjectOutput

> **InferObjectOutput**\<`T`\> = `{ [K in keyof T]: T[K]["_output"] }`

Defined in: [XmlObjectSchema.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L48)

Infer output type from object shape

#### Type Parameters

##### T

`T` *extends* [`XmlObjectShape`](#xmlobjectshape)

***

### ParseInput

> **ParseInput** = `string` \| `ReadableStream`\<`Uint8Array`\> \| `AsyncIterator`\<`AnyXmlEvent`\> \| `Iterator`\<`AnyXmlEvent`\>

Defined in: [base.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L11)

Parse input type - accepts string, sync iterator, async iterator, or ReadableStream

***

### ParseResult

> **ParseResult**\<`T`\> = \{ `success`: `true`; `data`: `T`; \} \| \{ `success`: `false`; `error`: [`XmlParseError`](#xmlparseerror); \}

Defined in: [errors.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/errors.ts#L28)

Parse result type for safe parsing operations

#### Type Parameters

##### T

`T`

***

### Infer

> **Infer**\<`T`\> = `T`\[`"_output"`\]

Defined in: [index.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/index.ts#L62)

#### Type Parameters

##### T

`T` *extends* [`XmlSchema`](#xmlschema)\<`unknown`, `unknown`\>

## Variables

### x

> `const` **x**: [`XmlBuilder`](#xmlbuilder)

Defined in: [XmlBuilder.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L58)

Singleton builder instance
