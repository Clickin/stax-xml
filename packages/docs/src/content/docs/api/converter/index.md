---
title: Converter API Reference
description: Complete API reference for the StAX-XML Converter module
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

Defined in: [XmlArraySchema.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L14)

Schema for parsing XML array values

#### Extends

- `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

#### Type Parameters

##### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

#### Constructors

##### Constructor

> **new XmlArraySchema**\<`T`\>(`element`, `xpath?`): [`XmlArraySchema`](#xmlarrayschema)\<`T`\>

Defined in: [XmlArraySchema.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L17)

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

Defined in: [XmlArraySchema.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L15)

**`Internal`**

Schema type identifier

###### Overrides

`XmlSchemaBase.schemaType`

##### element

> `readonly` **element**: `T`

Defined in: [XmlArraySchema.ts:18](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L18)

##### xpath?

> `readonly` `optional` **xpath**: `string`

Defined in: [XmlArraySchema.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L19)

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

Defined in: [base.ts:219](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L219)

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

Defined in: [base.ts:220](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L220)

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

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

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

Defined in: [XmlArraySchema.ts:24](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L24)

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

Defined in: [XmlArraySchema.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L29)

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

Defined in: [XmlArraySchema.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L38)

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

Defined in: [XmlArraySchema.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L73)

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

##### \_write()

> **\_write**(`data`, `options?`): `string`

Defined in: [XmlArraySchema.ts:83](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L83)

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

`XmlSchemaBase._write`

##### \_writeAsync()

> **\_writeAsync**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [XmlArraySchema.ts:121](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L121)

**`Internal`**

Write array data to XML asynchronously

###### Parameters

###### data

`T`\[`"_output"`\][]

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`string`\>

###### Overrides

`XmlSchemaBase._writeAsync`

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`T`\[`"_output"`\][]\>

Defined in: [base.ts:105](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L105)

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

Defined in: [base.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L116)

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

Defined in: [base.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L126)

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

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:167](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L167)

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

Defined in: [base.ts:175](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L175)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\][], `undefined` \| `T`\[`"_input"`\][]\>

New optional schema

###### Inherited from

`XmlSchemaBase.optional`

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`T`\[`"_output"`\][][], `T`\[`"_input"`\][][]\>

Defined in: [base.ts:184](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L184)

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

Defined in: [base.ts:194](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L194)

Write data to XML asynchronously (public API)

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

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:204](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L204)

Write data to XML synchronously (public API)

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

Defined in: [base.ts:213](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L213)

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

Defined in: [XmlNumberSchema.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L14)

Schema for parsing XML number values

#### Extends

- [`XmlSchema`](#xmlschema)\<`number`, `number`\>

#### Constructors

##### Constructor

> **new XmlNumberSchema**(`options`): [`XmlNumberSchema`](#xmlnumberschema)

Defined in: [XmlNumberSchema.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L17)

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

Defined in: [XmlNumberSchema.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L15)

**`Internal`**

Schema type identifier

###### Overrides

[`XmlSchema`](#xmlschema).[`schemaType`](#schematype-4)

##### options

> **options**: [`XmlNumberOptions`](#xmlnumberoptions) = `{}`

Defined in: [XmlNumberSchema.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L17)

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

Defined in: [base.ts:219](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L219)

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

Defined in: [base.ts:220](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L220)

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

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

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

Defined in: [XmlNumberSchema.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L21)

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

Defined in: [XmlNumberSchema.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L27)

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

Defined in: [XmlNumberSchema.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L33)

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

Defined in: [XmlNumberSchema.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L85)

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

Defined in: [XmlNumberSchema.ts:156](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L156)

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

Defined in: [XmlNumberSchema.ts:169](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L169)

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

Defined in: [XmlNumberSchema.ts:178](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L178)

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

Defined in: [XmlNumberSchema.ts:186](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L186)

Require integer value

###### Returns

[`XmlNumberSchema`](#xmlnumberschema)

New schema that only accepts integers

##### \_writeContent()

> **\_writeContent**(`data`, `options?`): `string`

Defined in: [XmlNumberSchema.ts:194](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L194)

**`Internal`**

Write raw content only (used inside object schema)

###### Parameters

###### data

`number`

###### options?

`XmlWriteOptions`

###### Returns

`string`

##### \_write()

> **\_write**(`data`, `options?`): `string`

Defined in: [XmlNumberSchema.ts:202](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L202)

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

[`XmlSchema`](#xmlschema).[`_write`](#_write-8)

##### \_writeAsync()

> **\_writeAsync**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [XmlNumberSchema.ts:239](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L239)

**`Internal`**

Write number data to XML asynchronously

###### Parameters

###### data

`number`

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`string`\>

###### Overrides

[`XmlSchema`](#xmlschema).[`_writeAsync`](#_writeasync-8)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`number`\>

Defined in: [base.ts:105](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L105)

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

Defined in: [base.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L116)

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

Defined in: [base.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L126)

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

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:167](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L167)

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

Defined in: [base.ts:175](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L175)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| `number`, `undefined` \| `number`\>

New optional schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`optional`](#optional-8)

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`number`[], `number`[]\>

Defined in: [base.ts:184](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L184)

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

Defined in: [base.ts:194](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L194)

Write data to XML asynchronously (public API)

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

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:204](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L204)

Write data to XML synchronously (public API)

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

Defined in: [base.ts:213](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L213)

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

Defined in: [XmlObjectSchema.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L30)

Schema for parsing XML object values

#### Extends

- [`XmlSchema`](#xmlschema)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>, `unknown`\>

#### Type Parameters

##### T

`T` *extends* [`XmlObjectShape`](#xmlobjectshape)

#### Constructors

##### Constructor

> **new XmlObjectSchema**\<`T`\>(`shape`, `options`): [`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

Defined in: [XmlObjectSchema.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L33)

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

Defined in: [XmlObjectSchema.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L31)

**`Internal`**

Schema type identifier

###### Overrides

[`XmlSchema`](#xmlschema).[`schemaType`](#schematype-4)

##### shape

> `readonly` **shape**: `T`

Defined in: [XmlObjectSchema.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L34)

##### options

> **options**: [`XmlObjectOptions`](#xmlobjectoptions) = `{}`

Defined in: [XmlObjectSchema.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L35)

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

Defined in: [base.ts:219](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L219)

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

Defined in: [base.ts:220](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L220)

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

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

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

Defined in: [XmlObjectSchema.ts:40](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L40)

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

Defined in: [XmlObjectSchema.ts:45](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L45)

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

Defined in: [XmlObjectSchema.ts:54](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L54)

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

Defined in: [XmlObjectSchema.ts:109](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L109)

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

Defined in: [XmlObjectSchema.ts:120](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L120)

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

Defined in: [XmlObjectSchema.ts:132](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L132)

**`Internal`**

Write raw content only (used inside parent object/array schema)

###### Parameters

###### data

[`InferObjectOutput`](#inferobjectoutput)\<`T`\>

###### options?

`XmlWriteOptions`

###### Returns

`string`

##### \_write()

> **\_write**(`data`, `options?`): `string`

Defined in: [XmlObjectSchema.ts:172](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L172)

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

[`XmlSchema`](#xmlschema).[`_write`](#_write-8)

##### \_writeAsync()

> **\_writeAsync**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [XmlObjectSchema.ts:249](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L249)

**`Internal`**

Write object data to XML asynchronously

###### Parameters

###### data

[`InferObjectOutput`](#inferobjectoutput)\<`T`\>

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`string`\>

###### Overrides

[`XmlSchema`](#xmlschema).[`_writeAsync`](#_writeasync-8)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Defined in: [base.ts:105](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L105)

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

Defined in: [base.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L116)

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

Defined in: [base.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L126)

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

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:167](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L167)

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

Defined in: [base.ts:175](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L175)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| [`InferObjectOutput`](#inferobjectoutput)\<`T`\>, `unknown`\>

New optional schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`optional`](#optional-8)

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>[], `unknown`[]\>

Defined in: [base.ts:184](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L184)

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

Defined in: [base.ts:194](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L194)

Write data to XML asynchronously (public API)

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

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:204](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L204)

Write data to XML synchronously (public API)

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

Defined in: [base.ts:213](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L213)

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

Defined in: [base.ts:219](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L219)

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

Defined in: [base.ts:220](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L220)

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

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

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

##### \_write()

> **\_write**(`data`, `options?`): `string`

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

`XmlSchemaBase._write`

##### \_writeAsync()

> **\_writeAsync**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [XmlOptionalSchema.ts:74](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L74)

**`Internal`**

Write optional data to XML asynchronously

###### Parameters

###### data

`undefined` | `T`\[`"_output"`\]

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`string`\>

###### Overrides

`XmlSchemaBase._writeAsync`

##### \_parseFromPosition()?

> `optional` **\_parseFromPosition**(`iterator`, `startEvent`, `startDepth`, `options?`): `undefined` \| `T`\[`"_output"`\] \| `Promise`\<`undefined` \| `T`\[`"_output"`\]\>

Defined in: [base.ts:91](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L91)

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

Defined in: [base.ts:105](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L105)

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

Defined in: [base.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L116)

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

Defined in: [base.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L126)

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

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:167](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L167)

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

Defined in: [base.ts:175](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L175)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| `T`\[`"_output"`\], `undefined` \| `T`\[`"_input"`\]\>

New optional schema

###### Inherited from

`XmlSchemaBase.optional`

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<(`undefined` \| `T`\[`"_output"`\])[], (`undefined` \| `T`\[`"_input"`\])[]\>

Defined in: [base.ts:184](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L184)

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

Defined in: [base.ts:194](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L194)

Write data to XML asynchronously (public API)

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

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:204](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L204)

Write data to XML synchronously (public API)

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

Defined in: [base.ts:213](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L213)

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

Defined in: [XmlSchema.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlSchema.ts#L11)

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

Defined in: [base.ts:219](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L219)

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

Defined in: [base.ts:220](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L220)

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

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

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

##### \_write()

> `abstract` **\_write**(`data`, `options?`): `string`

Defined in: [XmlSchema.ts:15](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlSchema.ts#L15)

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

###### Overrides

`XmlSchemaBase._write`

##### \_writeAsync()

> `abstract` **\_writeAsync**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [XmlSchema.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlSchema.ts#L16)

**`Internal`**

Write data to XML string asynchronously

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

###### Overrides

`XmlSchemaBase._writeAsync`

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

##### \_parseText()?

> `abstract` `optional` **\_parseText**(`text`): `Output`

Defined in: [base.ts:80](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L80)

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

Defined in: [base.ts:91](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L91)

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

Defined in: [base.ts:105](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L105)

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

Defined in: [base.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L116)

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

Defined in: [base.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L126)

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

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:167](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L167)

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

Defined in: [base.ts:175](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L175)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| `Output`, `undefined` \| `Input`\>

New optional schema

###### Inherited from

`XmlSchemaBase.optional`

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`Output`[], `Input`[]\>

Defined in: [base.ts:184](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L184)

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

Defined in: [base.ts:194](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L194)

Write data to XML asynchronously (public API)

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

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:204](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L204)

Write data to XML synchronously (public API)

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

Defined in: [base.ts:213](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L213)

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

Defined in: [XmlStringSchema.ts:13](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L13)

Schema for parsing XML string values

#### Extends

- [`XmlSchema`](#xmlschema)\<`string`, `string`\>

#### Constructors

##### Constructor

> **new XmlStringSchema**(`options`): [`XmlStringSchema`](#xmlstringschema)

Defined in: [XmlStringSchema.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L16)

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

Defined in: [XmlStringSchema.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L14)

**`Internal`**

Schema type identifier

###### Overrides

[`XmlSchema`](#xmlschema).[`schemaType`](#schematype-4)

##### options

> **options**: [`XmlStringOptions`](#xmlstringoptions) = `{}`

Defined in: [XmlStringSchema.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L16)

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

Defined in: [base.ts:219](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L219)

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

Defined in: [base.ts:220](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L220)

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

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

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

Defined in: [XmlStringSchema.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L20)

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

Defined in: [XmlStringSchema.ts:25](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L25)

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

Defined in: [XmlStringSchema.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L30)

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

Defined in: [XmlStringSchema.ts:38](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L38)

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

Defined in: [XmlStringSchema.ts:109](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L109)

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

Defined in: [XmlStringSchema.ts:121](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L121)

**`Internal`**

Write raw content only (used inside object schema)

###### Parameters

###### data

`string`

###### options?

`XmlWriteOptions`

###### Returns

`string`

##### \_write()

> **\_write**(`data`, `options?`): `string`

Defined in: [XmlStringSchema.ts:129](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L129)

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

[`XmlSchema`](#xmlschema).[`_write`](#_write-8)

##### \_writeAsync()

> **\_writeAsync**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [XmlStringSchema.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L171)

**`Internal`**

Write string data to XML asynchronously

###### Parameters

###### data

`string`

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`string`\>

###### Overrides

[`XmlSchema`](#xmlschema).[`_writeAsync`](#_writeasync-8)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:105](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L105)

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

Defined in: [base.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L116)

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

Defined in: [base.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L126)

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

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:167](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L167)

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

Defined in: [base.ts:175](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L175)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| `string`, `undefined` \| `string`\>

New optional schema

###### Inherited from

[`XmlSchema`](#xmlschema).[`optional`](#optional-8)

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`string`[], `string`[]\>

Defined in: [base.ts:184](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L184)

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

Defined in: [base.ts:194](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L194)

Write data to XML asynchronously (public API)

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

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:204](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L204)

Write data to XML synchronously (public API)

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

Defined in: [base.ts:213](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L213)

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

Defined in: [base.ts:219](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L219)

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

Defined in: [base.ts:220](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L220)

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

Defined in: [base.ts:221](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L221)

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

##### \_write()

> **\_write**(`data`, `options?`): `string`

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

`XmlSchemaBase._write`

##### \_writeAsync()

> **\_writeAsync**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [XmlTransformSchema.ts:85](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlTransformSchema.ts#L85)

**`Internal`**

Write transformed data to XML asynchronously
Note: Transform is not reversible, so writing is not supported

###### Parameters

###### data

`Output`

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`string`\>

###### Overrides

`XmlSchemaBase._writeAsync`

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`Output`\>

Defined in: [base.ts:105](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L105)

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

Defined in: [base.ts:116](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L116)

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

Defined in: [base.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L126)

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

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:167](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L167)

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

Defined in: [base.ts:175](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L175)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`undefined` \| `Output`, `undefined` \| `Input`\>

New optional schema

###### Inherited from

`XmlSchemaBase.optional`

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`Output`[], `Input`[]\>

Defined in: [base.ts:184](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L184)

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

Defined in: [base.ts:194](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L194)

Write data to XML asynchronously (public API)

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

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:204](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L204)

Write data to XML synchronously (public API)

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

Defined in: [base.ts:213](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L213)

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

Defined in: [types.ts:6](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L6)

Parse options for XML converter

#### Properties

##### trimText?

> `optional` **trimText**: `boolean`

Defined in: [types.ts:11](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L11)

Whether to trim whitespace from text content

###### Default Value

```ts
false
```

##### decodeEntities?

> `optional` **decodeEntities**: `boolean`

Defined in: [types.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L17)

Whether to decode XML entities

###### Default Value

```ts
true
```

##### strict?

> `optional` **strict**: `boolean`

Defined in: [types.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L23)

Strict mode for parsing

###### Default Value

```ts
false
```

##### maxDepth?

> `optional` **maxDepth**: `number`

Defined in: [types.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L29)

Maximum XML depth

###### Default Value

```ts
1000
```

##### maxEvents?

> `optional` **maxEvents**: `number`

Defined in: [types.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L35)

Maximum number of events to process

###### Default Value

```ts
1000000
```

***

### XmlStringOptions

Defined in: [types.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L43)

Options for string schema

#### Properties

##### xpath?

> `optional` **xpath**: `string`

Defined in: [types.ts:47](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L47)

XPath expression to locate the element

##### min?

> `optional` **min**: `number`

Defined in: [types.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L52)

Minimum string length

##### max?

> `optional` **max**: `number`

Defined in: [types.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L57)

Maximum string length

##### pattern?

> `optional` **pattern**: `RegExp`

Defined in: [types.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L62)

Regular expression pattern to validate against

***

### XmlNumberOptions

Defined in: [types.ts:70](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L70)

Options for number schema

#### Properties

##### xpath?

> `optional` **xpath**: `string`

Defined in: [types.ts:74](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L74)

XPath expression to locate the element

##### min?

> `optional` **min**: `number`

Defined in: [types.ts:79](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L79)

Minimum value

##### max?

> `optional` **max**: `number`

Defined in: [types.ts:84](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L84)

Maximum value

##### int?

> `optional` **int**: `boolean`

Defined in: [types.ts:90](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L90)

Whether the number must be an integer

###### Default Value

```ts
false
```

***

### XmlObjectOptions

Defined in: [types.ts:98](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L98)

Options for object schema

#### Properties

##### xpath?

> `optional` **xpath**: `string`

Defined in: [types.ts:102](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L102)

XPath expression to locate the element

##### strict?

> `optional` **strict**: `boolean`

Defined in: [types.ts:108](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L108)

Strict mode - reject unknown properties

###### Default Value

```ts
false
```

## Type Aliases

### XmlObjectShape

> **XmlObjectShape** = `Record`\<`string`, [`XmlSchema`](#xmlschema)\<`unknown`, `unknown`\>\>

Defined in: [XmlObjectSchema.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L14)

Shape type for object schema

***

### InferObjectOutput

> **InferObjectOutput**\<`T`\> = `{ [K in keyof T]: T[K]["_output"] }`

Defined in: [XmlObjectSchema.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L21)

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
