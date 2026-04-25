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

Defined in: [XmlArraySchema.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L16)

Schema for parsing XML array values

#### Extends

- `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

#### Type Parameters

##### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

#### Constructors

##### Constructor

> **new XmlArraySchema**\<`T`\>(`element`, `xpath?`): [`XmlArraySchema`](#xmlarrayschema)\<`T`\>

Defined in: [XmlArraySchema.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L19)

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

Defined in: [XmlArraySchema.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L17)

**`Internal`**

Schema type identifier

###### Overrides

`XmlSchemaBase.schemaType`

##### element

> `readonly` **element**: `T`

Defined in: [XmlArraySchema.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L20)

##### xpath?

> `readonly` `optional` **xpath?**: `string`

Defined in: [XmlArraySchema.ts:21](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L21)

##### \_output

> `readonly` **\_output**: `T`\[`"_output"`\][]

Defined in: [base.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L26)

###### Inherited from

`XmlSchemaBase._output`

##### \_input

> `readonly` **\_input**: `T`\[`"_input"`\][]

Defined in: [base.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L27)

###### Inherited from

`XmlSchemaBase._input`

##### writeConfig?

> `protected` `optional` **writeConfig?**: `XmlElementWriteConfig`

Defined in: [base.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L39)

**`Internal`**

Writer configuration for this schema

###### Inherited from

[`XmlStringSchema`](#xmlstringschema).[`writeConfig`](#writeconfig-5)

##### \_createTransform

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:296](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L296)

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

##### \_createOptional

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [base.ts:297](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L297)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

###### Inherited from

`XmlSchemaBase._createOptional`

##### \_createArray

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:298](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L298)

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

##### \_createCompiled

> `static` **\_createCompiled**: \<`Output`, `Input`\>(`schema`) => `XmlSchemaBase`\<`Output`, `Input`\>

Defined in: [base.ts:299](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L299)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### Returns

`XmlSchemaBase`\<`Output`, `Input`\>

###### Inherited from

`XmlSchemaBase._createCompiled`

##### \_tryParseWithCompiledPlan?

> `static` `optional` **\_tryParseWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `AutoParseResult`\<`Output`\>

Defined in: [base.ts:300](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L300)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`AutoParseResult`\<`Output`\>

###### Inherited from

`XmlSchemaBase._tryParseWithCompiledPlan`

##### \_tryParseAsyncWithCompiledPlan?

> `static` `optional` **\_tryParseAsyncWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `Promise`\<`AutoParseResult`\<`Output`\>\>

Defined in: [base.ts:305](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L305)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

[`ParseInput`](#parseinput)

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`Promise`\<`AutoParseResult`\<`Output`\>\>

###### Inherited from

`XmlSchemaBase._tryParseAsyncWithCompiledPlan`

#### Methods

##### \_parse()

> **\_parse**(`input`, `parseOptions?`): `T`\[`"_output"`\][]

Defined in: [XmlArraySchema.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L26)

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

Defined in: [XmlArraySchema.ts:31](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L31)

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

Defined in: [XmlArraySchema.ts:40](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L40)

**`Internal`**

Parse array from current iterator position (for nested array parsing)

###### Parameters

###### iterator

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

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

Defined in: [XmlArraySchema.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L72)

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

Defined in: [XmlArraySchema.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L82)

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

Defined in: [XmlArraySchema.ts:152](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlArraySchema.ts#L152)

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

Defined in: [base.ts:112](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L112)

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

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

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

`XmlSchemaBase.parseSync`

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`T`\[`"_output"`\][]\>\>

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L168)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

XML string or sync iterator

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

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

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

> **optional**(): `XmlSchemaBase`\<`T`\[`"_output"`\][] \| `undefined`, `T`\[`"_input"`\][] \| `undefined`\>

Defined in: [base.ts:196](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L196)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\][] \| `undefined`, `T`\[`"_input"`\][] \| `undefined`\>

New optional schema

###### Inherited from

`XmlSchemaBase.optional`

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`T`\[`"_output"`\][][], `T`\[`"_input"`\][][]\>

Defined in: [base.ts:205](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L205)

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

##### compile()

> **compile**(): `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:233](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L233)

Compile this schema for repeated parsing.

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

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

`XmlSchemaBase.compile`

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

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

Defined in: [base.ts:267](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L267)

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

Defined in: [base.ts:281](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L281)

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

Defined in: [base.ts:290](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L290)

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

Defined in: [XmlNumberSchema.ts:16](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L16)

Schema for parsing XML number values

#### Extends

- [`XmlSchema`](#abstract-xmlschema)\<`number`, `number`\>

#### Constructors

##### Constructor

> **new XmlNumberSchema**(`options?`): [`XmlNumberSchema`](#xmlnumberschema)

Defined in: [XmlNumberSchema.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L19)

###### Parameters

###### options?

[`XmlNumberOptions`](#xmlnumberoptions) = `{}`

###### Returns

[`XmlNumberSchema`](#xmlnumberschema)

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`constructor`](#constructor-5)

#### Properties

##### schemaType

> `readonly` **schemaType**: `"NUMBER"` = `SchemaType.NUMBER`

Defined in: [XmlNumberSchema.ts:17](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L17)

**`Internal`**

Schema type identifier

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`schemaType`](#schematype-4)

##### options

> **options**: [`XmlNumberOptions`](#xmlnumberoptions) = `{}`

Defined in: [XmlNumberSchema.ts:19](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L19)

##### \_output

> `readonly` **\_output**: `number`

Defined in: [base.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L26)

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_output`](#_output-4)

##### \_input

> `readonly` **\_input**: `number`

Defined in: [base.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L27)

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_input`](#_input-4)

##### writeConfig?

> `protected` `optional` **writeConfig?**: `XmlElementWriteConfig`

Defined in: [base.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L39)

**`Internal`**

Writer configuration for this schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writeConfig`](#writeconfig-4)

##### \_createTransform

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:296](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L296)

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

[`XmlSchema`](#abstract-xmlschema).[`_createTransform`](#_createtransform-4)

##### \_createOptional

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [base.ts:297](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L297)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_createOptional`](#_createoptional-4)

##### \_createArray

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:298](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L298)

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

[`XmlSchema`](#abstract-xmlschema).[`_createArray`](#_createarray-4)

##### \_createCompiled

> `static` **\_createCompiled**: \<`Output`, `Input`\>(`schema`) => `XmlSchemaBase`\<`Output`, `Input`\>

Defined in: [base.ts:299](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L299)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### Returns

`XmlSchemaBase`\<`Output`, `Input`\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_createCompiled`](#_createcompiled-4)

##### \_tryParseWithCompiledPlan?

> `static` `optional` **\_tryParseWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `AutoParseResult`\<`Output`\>

Defined in: [base.ts:300](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L300)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`AutoParseResult`\<`Output`\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_tryParseWithCompiledPlan`](#_tryparsewithcompiledplan-4)

##### \_tryParseAsyncWithCompiledPlan?

> `static` `optional` **\_tryParseAsyncWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `Promise`\<`AutoParseResult`\<`Output`\>\>

Defined in: [base.ts:305](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L305)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

[`ParseInput`](#parseinput)

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`Promise`\<`AutoParseResult`\<`Output`\>\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_tryParseAsyncWithCompiledPlan`](#_tryparseasyncwithcompiledplan-4)

#### Methods

##### \_parse()

> **\_parse**(`input`, `parseOptions?`): `number`

Defined in: [XmlNumberSchema.ts:23](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L23)

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

[`XmlSchema`](#abstract-xmlschema).[`_parse`](#_parse-4)

##### \_parseAsync()

> **\_parseAsync**(`input`, `parseOptions?`): `Promise`\<`number`\>

Defined in: [XmlNumberSchema.ts:29](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L29)

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

##### \_parseText()

> **\_parseText**(`text`): `number`

Defined in: [XmlNumberSchema.ts:35](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L35)

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

[`XmlSchema`](#abstract-xmlschema).[`_parseText`](#_parsetext-4)

##### \_parseFromPosition()

> **\_parseFromPosition**(`iterator`, `startEvent`, `startDepth`, `options?`): `number` \| `Promise`\<`number`\>

Defined in: [XmlNumberSchema.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L87)

**`Internal`**

Parse from current iterator position

###### Parameters

###### iterator

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### startEvent

`StartElementEvent`

###### startDepth

`number`

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`number` \| `Promise`\<`number`\>

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`_parseFromPosition`](#_parsefromposition-4)

##### xpath()

> **xpath**(`path`): [`XmlNumberSchema`](#xmlnumberschema)

Defined in: [XmlNumberSchema.ts:158](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L158)

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

Defined in: [XmlNumberSchema.ts:171](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L171)

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

Defined in: [XmlNumberSchema.ts:180](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L180)

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

Defined in: [XmlNumberSchema.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L188)

Require integer value

###### Returns

[`XmlNumberSchema`](#xmlnumberschema)

New schema that only accepts integers

##### \_writeContent()

> **\_writeContent**(`data`, `options?`): `string`

Defined in: [XmlNumberSchema.ts:196](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L196)

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

Defined in: [XmlNumberSchema.ts:204](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L204)

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

[`XmlSchema`](#abstract-xmlschema).[`_writeSync`](#_writesync-4)

##### \_write()

> **\_write**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [XmlNumberSchema.ts:273](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlNumberSchema.ts#L273)

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

[`XmlSchema`](#abstract-xmlschema).[`_write`](#_write-4)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`number`\>

Defined in: [base.ts:112](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L112)

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

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

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

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L168)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`number`\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`safeParseSync`](#safeparsesync-4)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): `XmlSchemaBase`\<`NewOutput`, `number`\>

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

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

[`XmlSchema`](#abstract-xmlschema).[`transform`](#transform-4)

##### optional()

> **optional**(): `XmlSchemaBase`\<`number` \| `undefined`, `number` \| `undefined`\>

Defined in: [base.ts:196](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L196)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`number` \| `undefined`, `number` \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`optional`](#optional-4)

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`number`[], `number`[]\>

Defined in: [base.ts:205](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L205)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

`XmlSchemaBase`\<`number`[], `number`[]\>

New array schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`array`](#array-5)

##### compile()

> **compile**(): `XmlSchemaBase`\<`number`, `number`\>

Defined in: [base.ts:233](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L233)

Compile this schema for repeated parsing.

###### Returns

`XmlSchemaBase`\<`number`, `number`\>

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

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

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

[`XmlSchema`](#abstract-xmlschema).[`write`](#write-4)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:267](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L267)

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

[`XmlSchema`](#abstract-xmlschema).[`writeToStream`](#writetostream-4)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:281](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L281)

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

[`XmlSchema`](#abstract-xmlschema).[`writeSync`](#writesync-4)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:290](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L290)

Configure writer settings for this schema

###### Parameters

###### config

`XmlElementWriteConfig`

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writer`](#writer-4)

***

### XmlObjectSchema

Defined in: [XmlObjectSchema.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L58)

Schema for parsing XML object values

#### Extends

- [`XmlSchema`](#abstract-xmlschema)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>, `unknown`\>

#### Type Parameters

##### T

`T` *extends* [`XmlObjectShape`](#xmlobjectshape)

#### Constructors

##### Constructor

> **new XmlObjectSchema**\<`T`\>(`shape`, `options?`): [`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

Defined in: [XmlObjectSchema.ts:61](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L61)

###### Parameters

###### shape

`T`

###### options?

[`XmlObjectOptions`](#xmlobjectoptions) = `{}`

###### Returns

[`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`constructor`](#constructor-5)

#### Properties

##### schemaType

> `readonly` **schemaType**: `"OBJECT"` = `SchemaType.OBJECT`

Defined in: [XmlObjectSchema.ts:59](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L59)

**`Internal`**

Schema type identifier

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`schemaType`](#schematype-4)

##### shape

> `readonly` **shape**: `T`

Defined in: [XmlObjectSchema.ts:62](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L62)

##### options

> **options**: [`XmlObjectOptions`](#xmlobjectoptions) = `{}`

Defined in: [XmlObjectSchema.ts:63](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L63)

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [base.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L26)

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_output`](#_output-4)

##### \_input

> `readonly` **\_input**: `unknown`

Defined in: [base.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L27)

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_input`](#_input-4)

##### writeConfig?

> `protected` `optional` **writeConfig?**: `XmlElementWriteConfig`

Defined in: [base.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L39)

**`Internal`**

Writer configuration for this schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writeConfig`](#writeconfig-4)

##### \_createTransform

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:296](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L296)

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

[`XmlSchema`](#abstract-xmlschema).[`_createTransform`](#_createtransform-4)

##### \_createOptional

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [base.ts:297](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L297)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_createOptional`](#_createoptional-4)

##### \_createArray

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:298](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L298)

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

[`XmlSchema`](#abstract-xmlschema).[`_createArray`](#_createarray-4)

##### \_createCompiled

> `static` **\_createCompiled**: \<`Output`, `Input`\>(`schema`) => `XmlSchemaBase`\<`Output`, `Input`\>

Defined in: [base.ts:299](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L299)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### Returns

`XmlSchemaBase`\<`Output`, `Input`\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_createCompiled`](#_createcompiled-4)

##### \_tryParseWithCompiledPlan?

> `static` `optional` **\_tryParseWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `AutoParseResult`\<`Output`\>

Defined in: [base.ts:300](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L300)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`AutoParseResult`\<`Output`\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_tryParseWithCompiledPlan`](#_tryparsewithcompiledplan-4)

##### \_tryParseAsyncWithCompiledPlan?

> `static` `optional` **\_tryParseAsyncWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `Promise`\<`AutoParseResult`\<`Output`\>\>

Defined in: [base.ts:305](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L305)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

[`ParseInput`](#parseinput)

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`Promise`\<`AutoParseResult`\<`Output`\>\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_tryParseAsyncWithCompiledPlan`](#_tryparseasyncwithcompiledplan-4)

#### Methods

##### \_parse()

> **\_parse**(`input`, `parseOptions?`): [`InferObjectOutput`](#inferobjectoutput)\<`T`\>

Defined in: [XmlObjectSchema.ts:68](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L68)

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

[`XmlSchema`](#abstract-xmlschema).[`_parse`](#_parse-4)

##### \_parseAsync()

> **\_parseAsync**(`input`, `parseOptions?`): `Promise`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Defined in: [XmlObjectSchema.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L73)

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

##### \_parseFromPosition()

> **\_parseFromPosition**(`iterator`, `startEvent`, `startDepth`, `options?`, `stateMachine?`, `parentContext?`): [`InferObjectOutput`](#inferobjectoutput)\<`T`\> \| `Promise`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Defined in: [XmlObjectSchema.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L82)

**`Internal`**

Parse from current iterator position (for recursive/streaming parsing)

###### Parameters

###### iterator

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

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

[`XmlSchema`](#abstract-xmlschema).[`_parseFromPosition`](#_parsefromposition-4)

##### \_parseText()

> **\_parseText**(`text`): [`InferObjectOutput`](#inferobjectoutput)\<`T`\>

Defined in: [XmlObjectSchema.ts:115](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L115)

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

[`XmlSchema`](#abstract-xmlschema).[`_parseText`](#_parsetext-4)

##### xpath()

> **xpath**(`path`): [`XmlObjectSchema`](#xmlobjectschema)\<`T`\>

Defined in: [XmlObjectSchema.ts:126](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L126)

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

Defined in: [XmlObjectSchema.ts:138](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L138)

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

Defined in: [XmlObjectSchema.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L168)

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

[`XmlSchema`](#abstract-xmlschema).[`_writeSync`](#_writesync-4)

##### \_write()

> **\_write**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [XmlObjectSchema.ts:291](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L291)

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

[`XmlSchema`](#abstract-xmlschema).[`_write`](#_write-4)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Defined in: [base.ts:112](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L112)

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

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

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

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L168)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`safeParseSync`](#safeparsesync-4)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): `XmlSchemaBase`\<`NewOutput`, `unknown`\>

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

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

[`XmlSchema`](#abstract-xmlschema).[`transform`](#transform-4)

##### optional()

> **optional**(): `XmlSchemaBase`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\> \| `undefined`, `unknown`\>

Defined in: [base.ts:196](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L196)

Make this schema optional

###### Returns

`XmlSchemaBase`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\> \| `undefined`, `unknown`\>

New optional schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`optional`](#optional-4)

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>[], `unknown`[]\>

Defined in: [base.ts:205](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L205)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

`XmlSchemaBase`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>[], `unknown`[]\>

New array schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`array`](#array-5)

##### compile()

> **compile**(): `XmlSchemaBase`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>, `unknown`\>

Defined in: [base.ts:233](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L233)

Compile this schema for repeated parsing.

###### Returns

`XmlSchemaBase`\<[`InferObjectOutput`](#inferobjectoutput)\<`T`\>, `unknown`\>

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

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

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

[`XmlSchema`](#abstract-xmlschema).[`write`](#write-4)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:267](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L267)

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

[`XmlSchema`](#abstract-xmlschema).[`writeToStream`](#writetostream-4)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:281](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L281)

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

[`XmlSchema`](#abstract-xmlschema).[`writeSync`](#writesync-4)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:290](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L290)

Configure writer settings for this schema

###### Parameters

###### config

`XmlElementWriteConfig`

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writer`](#writer-4)

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

> `readonly` **\_output**: `T`\[`"_output"`\] \| `undefined`

Defined in: [base.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L26)

###### Inherited from

`XmlSchemaBase._output`

##### \_input

> `readonly` **\_input**: `T`\[`"_input"`\] \| `undefined`

Defined in: [base.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L27)

###### Inherited from

`XmlSchemaBase._input`

##### writeConfig?

> `protected` `optional` **writeConfig?**: `XmlElementWriteConfig`

Defined in: [base.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L39)

**`Internal`**

Writer configuration for this schema

###### Inherited from

`XmlSchemaBase.writeConfig`

##### \_createTransform

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:296](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L296)

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

##### \_createOptional

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [base.ts:297](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L297)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

###### Inherited from

`XmlSchemaBase._createOptional`

##### \_createArray

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:298](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L298)

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

##### \_createCompiled

> `static` **\_createCompiled**: \<`Output`, `Input`\>(`schema`) => `XmlSchemaBase`\<`Output`, `Input`\>

Defined in: [base.ts:299](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L299)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### Returns

`XmlSchemaBase`\<`Output`, `Input`\>

###### Inherited from

`XmlSchemaBase._createCompiled`

##### \_tryParseWithCompiledPlan?

> `static` `optional` **\_tryParseWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `AutoParseResult`\<`Output`\>

Defined in: [base.ts:300](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L300)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`AutoParseResult`\<`Output`\>

###### Inherited from

`XmlSchemaBase._tryParseWithCompiledPlan`

##### \_tryParseAsyncWithCompiledPlan?

> `static` `optional` **\_tryParseAsyncWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `Promise`\<`AutoParseResult`\<`Output`\>\>

Defined in: [base.ts:305](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L305)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

[`ParseInput`](#parseinput)

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`Promise`\<`AutoParseResult`\<`Output`\>\>

###### Inherited from

`XmlSchemaBase._tryParseAsyncWithCompiledPlan`

#### Methods

##### \_parse()

> **\_parse**(`input`, `options?`): `T`\[`"_output"`\] \| `undefined`

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

`T`\[`"_output"`\] \| `undefined`

Parsed output

###### Throws

If parsing fails

###### Overrides

`XmlSchemaBase._parse`

##### \_parseAsync()

> **\_parseAsync**(`input`, `options?`): `Promise`\<`T`\[`"_output"`\] \| `undefined`\>

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

`Promise`\<`T`\[`"_output"`\] \| `undefined`\>

Parsed output

###### Throws

If parsing fails

###### Overrides

`XmlSchemaBase._parseAsync`

##### \_parseText()

> **\_parseText**(`text`): `T`\[`"_output"`\] \| `undefined`

Defined in: [XmlOptionalSchema.ts:43](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlOptionalSchema.ts#L43)

**`Internal`**

Parse text content (used internally by parser)

###### Parameters

###### text

`string`

Text content

###### Returns

`T`\[`"_output"`\] \| `undefined`

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

`T`\[`"_output"`\] \| `undefined`

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

`T`\[`"_output"`\] \| `undefined`

###### stream

`WritableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### options?

`XmlWriteOptions`

###### Returns

`Promise`\<`void`\>

###### Overrides

`XmlSchemaBase._write`

##### \_parseFromPosition()?

> `optional` **\_parseFromPosition**(`iterator`, `startEvent`, `startDepth`, `options?`): `T`\[`"_output"`\] \| `Promise`\<`T`\[`"_output"`\] \| `undefined`\> \| `undefined`

Defined in: [base.ts:98](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L98)

**`Internal`**

Parse from current iterator position (for streaming/recursive parsing)

###### Parameters

###### iterator

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

Event iterator at current position

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

`T`\[`"_output"`\] \| `Promise`\<`T`\[`"_output"`\] \| `undefined`\> \| `undefined`

Parsed output

###### Inherited from

`XmlSchemaBase._parseFromPosition`

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`T`\[`"_output"`\] \| `undefined`\>

Defined in: [base.ts:112](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L112)

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

`XmlSchemaBase.parse`

##### parseSync()

> **parseSync**(`input`, `options?`): `T`\[`"_output"`\] \| `undefined`

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

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

`XmlSchemaBase.parseSync`

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`T`\[`"_output"`\] \| `undefined`\>\>

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

`XmlSchemaBase.safeParse`

##### safeParseSync()

> **safeParseSync**(`input`, `options?`): [`ParseResult`](#parseresult)\<`T`\[`"_output"`\] \| `undefined`\>

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L168)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`T`\[`"_output"`\] \| `undefined`\>

Parse result with success flag

###### Inherited from

`XmlSchemaBase.safeParseSync`

##### transform()

> **transform**\<`NewOutput`\>(`fn`): `XmlSchemaBase`\<`NewOutput`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

Transform the parsed output

###### Type Parameters

###### NewOutput

`NewOutput`

###### Parameters

###### fn

(`value`) => `NewOutput`

Transform function

###### Returns

`XmlSchemaBase`\<`NewOutput`, `T`\[`"_input"`\] \| `undefined`\>

New schema with transform applied

###### Inherited from

`XmlSchemaBase.transform`

##### optional()

> **optional**(): `XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [base.ts:196](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L196)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

New optional schema

###### Inherited from

`XmlSchemaBase.optional`

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<(`T`\[`"_output"`\] \| `undefined`)[], (`T`\[`"_input"`\] \| `undefined`)[]\>

Defined in: [base.ts:205](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L205)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

`XmlSchemaBase`\<(`T`\[`"_output"`\] \| `undefined`)[], (`T`\[`"_input"`\] \| `undefined`)[]\>

New array schema

###### Inherited from

`XmlSchemaBase.array`

##### compile()

> **compile**(): `XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [base.ts:233](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L233)

Compile this schema for repeated parsing.

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

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

`XmlSchemaBase.compile`

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

Write data to XML string asynchronously (public API)

###### Parameters

###### data

`T`\[`"_output"`\] \| `undefined`

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

Defined in: [base.ts:267](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L267)

Write data to WritableStream asynchronously (public API)

###### Parameters

###### data

`T`\[`"_output"`\] \| `undefined`

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

Defined in: [base.ts:281](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L281)

Write data to XML string synchronously (public API)

###### Parameters

###### data

`T`\[`"_output"`\] \| `undefined`

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

Defined in: [base.ts:290](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L290)

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

> **new XmlSchema**\<`Output`, `Input`\>(): [`XmlSchema`](#abstract-xmlschema)\<`Output`, `Input`\>

###### Returns

[`XmlSchema`](#abstract-xmlschema)\<`Output`, `Input`\>

###### Inherited from

`XmlSchemaBase<Output, Input>.constructor`

#### Properties

##### \_createTransform

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:296](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L296)

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

##### \_createOptional

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [base.ts:297](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L297)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

###### Inherited from

`XmlSchemaBase._createOptional`

##### \_createArray

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:298](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L298)

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

##### \_createCompiled

> `static` **\_createCompiled**: \<`Output`, `Input`\>(`schema`) => `XmlSchemaBase`\<`Output`, `Input`\>

Defined in: [base.ts:299](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L299)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### Returns

`XmlSchemaBase`\<`Output`, `Input`\>

###### Inherited from

`XmlSchemaBase._createCompiled`

##### \_tryParseWithCompiledPlan?

> `static` `optional` **\_tryParseWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `AutoParseResult`\<`Output`\>

Defined in: [base.ts:300](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L300)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`AutoParseResult`\<`Output`\>

###### Inherited from

`XmlSchemaBase._tryParseWithCompiledPlan`

##### \_tryParseAsyncWithCompiledPlan?

> `static` `optional` **\_tryParseAsyncWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `Promise`\<`AutoParseResult`\<`Output`\>\>

Defined in: [base.ts:305](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L305)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

[`ParseInput`](#parseinput)

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`Promise`\<`AutoParseResult`\<`Output`\>\>

###### Inherited from

`XmlSchemaBase._tryParseAsyncWithCompiledPlan`

##### \_output

> `readonly` **\_output**: `Output`

Defined in: [base.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L26)

###### Inherited from

`XmlSchemaBase._output`

##### \_input

> `readonly` **\_input**: `Input`

Defined in: [base.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L27)

###### Inherited from

`XmlSchemaBase._input`

##### schemaType

> `abstract` `readonly` **schemaType**: `SchemaType`

Defined in: [base.ts:33](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L33)

**`Internal`**

Schema type identifier

###### Inherited from

`XmlSchemaBase.schemaType`

##### writeConfig?

> `protected` `optional` **writeConfig?**: `XmlElementWriteConfig`

Defined in: [base.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L39)

**`Internal`**

Writer configuration for this schema

###### Inherited from

[`XmlStringSchema`](#xmlstringschema).[`writeConfig`](#writeconfig-5)

#### Methods

##### \_parse()

> `abstract` **\_parse**(`input`, `options?`): `Output`

Defined in: [base.ts:48](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L48)

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

Defined in: [base.ts:57](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L57)

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

Defined in: [base.ts:66](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L66)

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

Defined in: [base.ts:75](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L75)

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

Defined in: [base.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L87)

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

Defined in: [base.ts:98](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L98)

**`Internal`**

Parse from current iterator position (for streaming/recursive parsing)

###### Parameters

###### iterator

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

Event iterator at current position

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

Defined in: [base.ts:112](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L112)

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

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

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

`XmlSchemaBase.parseSync`

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L168)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

XML string or sync iterator

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

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

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

> **optional**(): `XmlSchemaBase`\<`Output` \| `undefined`, `Input` \| `undefined`\>

Defined in: [base.ts:196](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L196)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`Output` \| `undefined`, `Input` \| `undefined`\>

New optional schema

###### Inherited from

`XmlSchemaBase.optional`

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`Output`[], `Input`[]\>

Defined in: [base.ts:205](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L205)

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

##### compile()

> **compile**(): `XmlSchemaBase`\<`Output`, `Input`\>

Defined in: [base.ts:233](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L233)

Compile this schema for repeated parsing.

###### Returns

`XmlSchemaBase`\<`Output`, `Input`\>

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

`XmlSchemaBase.compile`

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

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

Defined in: [base.ts:267](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L267)

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

Defined in: [base.ts:281](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L281)

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

Defined in: [base.ts:290](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L290)

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

Defined in: [XmlStringSchema.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L27)

Schema for parsing XML string values

#### Extends

- [`XmlSchema`](#abstract-xmlschema)\<`string`, `string`\>

#### Constructors

##### Constructor

> **new XmlStringSchema**(`options?`): [`XmlStringSchema`](#xmlstringschema)

Defined in: [XmlStringSchema.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L30)

###### Parameters

###### options?

[`XmlStringOptions`](#xmlstringoptions) = `{}`

###### Returns

[`XmlStringSchema`](#xmlstringschema)

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`constructor`](#constructor-5)

#### Properties

##### schemaType

> `readonly` **schemaType**: `"STRING"` = `SchemaType.STRING`

Defined in: [XmlStringSchema.ts:28](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L28)

**`Internal`**

Schema type identifier

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`schemaType`](#schematype-4)

##### options

> **options**: [`XmlStringOptions`](#xmlstringoptions) = `{}`

Defined in: [XmlStringSchema.ts:30](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L30)

##### \_output

> `readonly` **\_output**: `string`

Defined in: [base.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L26)

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_output`](#_output-4)

##### \_input

> `readonly` **\_input**: `string`

Defined in: [base.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L27)

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_input`](#_input-4)

##### writeConfig?

> `protected` `optional` **writeConfig?**: `XmlElementWriteConfig`

Defined in: [base.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L39)

**`Internal`**

Writer configuration for this schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writeConfig`](#writeconfig-4)

##### \_createTransform

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:296](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L296)

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

[`XmlSchema`](#abstract-xmlschema).[`_createTransform`](#_createtransform-4)

##### \_createOptional

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [base.ts:297](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L297)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_createOptional`](#_createoptional-4)

##### \_createArray

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:298](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L298)

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

[`XmlSchema`](#abstract-xmlschema).[`_createArray`](#_createarray-4)

##### \_createCompiled

> `static` **\_createCompiled**: \<`Output`, `Input`\>(`schema`) => `XmlSchemaBase`\<`Output`, `Input`\>

Defined in: [base.ts:299](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L299)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### Returns

`XmlSchemaBase`\<`Output`, `Input`\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_createCompiled`](#_createcompiled-4)

##### \_tryParseWithCompiledPlan?

> `static` `optional` **\_tryParseWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `AutoParseResult`\<`Output`\>

Defined in: [base.ts:300](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L300)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`AutoParseResult`\<`Output`\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_tryParseWithCompiledPlan`](#_tryparsewithcompiledplan-4)

##### \_tryParseAsyncWithCompiledPlan?

> `static` `optional` **\_tryParseAsyncWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `Promise`\<`AutoParseResult`\<`Output`\>\>

Defined in: [base.ts:305](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L305)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

[`ParseInput`](#parseinput)

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`Promise`\<`AutoParseResult`\<`Output`\>\>

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`_tryParseAsyncWithCompiledPlan`](#_tryparseasyncwithcompiledplan-4)

#### Methods

##### \_parse()

> **\_parse**(`input`, `parseOptions?`): `string`

Defined in: [XmlStringSchema.ts:34](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L34)

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

[`XmlSchema`](#abstract-xmlschema).[`_parse`](#_parse-4)

##### \_parseAsync()

> **\_parseAsync**(`input`, `parseOptions?`): `Promise`\<`string`\>

Defined in: [XmlStringSchema.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L39)

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

##### \_parseText()

> **\_parseText**(`text`): `string`

Defined in: [XmlStringSchema.ts:44](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L44)

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

[`XmlSchema`](#abstract-xmlschema).[`_parseText`](#_parsetext-4)

##### \_parseFromPosition()

> **\_parseFromPosition**(`iterator`, `startEvent`, `startDepth`, `options?`): `string` \| `Promise`\<`string`\>

Defined in: [XmlStringSchema.ts:52](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L52)

**`Internal`**

Parse from current iterator position

###### Parameters

###### iterator

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### startEvent

`StartElementEvent`

###### startDepth

`number`

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`string` \| `Promise`\<`string`\>

###### Overrides

[`XmlSchema`](#abstract-xmlschema).[`_parseFromPosition`](#_parsefromposition-4)

##### xpath()

> **xpath**(`path`): [`XmlStringSchema`](#xmlstringschema)

Defined in: [XmlStringSchema.ts:123](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L123)

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

Defined in: [XmlStringSchema.ts:135](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L135)

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

Defined in: [XmlStringSchema.ts:143](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L143)

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

[`XmlSchema`](#abstract-xmlschema).[`_writeSync`](#_writesync-4)

##### \_write()

> **\_write**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [XmlStringSchema.ts:217](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlStringSchema.ts#L217)

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

[`XmlSchema`](#abstract-xmlschema).[`_write`](#_write-4)

##### parse()

> **parse**(`input`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:112](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L112)

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

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

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

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L168)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

XML string or sync iterator

###### options?

[`ParseOptions`](#parseoptions)

Parse options

###### Returns

[`ParseResult`](#parseresult)\<`string`\>

Parse result with success flag

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`safeParseSync`](#safeparsesync-4)

##### transform()

> **transform**\<`NewOutput`\>(`fn`): `XmlSchemaBase`\<`NewOutput`, `string`\>

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

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

[`XmlSchema`](#abstract-xmlschema).[`transform`](#transform-4)

##### optional()

> **optional**(): `XmlSchemaBase`\<`string` \| `undefined`, `string` \| `undefined`\>

Defined in: [base.ts:196](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L196)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`string` \| `undefined`, `string` \| `undefined`\>

New optional schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`optional`](#optional-4)

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`string`[], `string`[]\>

Defined in: [base.ts:205](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L205)

Convert this schema to an array schema

###### Parameters

###### xpath?

`string`

XPath expression for array elements

###### Returns

`XmlSchemaBase`\<`string`[], `string`[]\>

New array schema

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`array`](#array-5)

##### compile()

> **compile**(): `XmlSchemaBase`\<`string`, `string`\>

Defined in: [base.ts:233](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L233)

Compile this schema for repeated parsing.

###### Returns

`XmlSchemaBase`\<`string`, `string`\>

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

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

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

[`XmlSchema`](#abstract-xmlschema).[`write`](#write-4)

##### writeToStream()

> **writeToStream**(`data`, `stream`, `options?`): `Promise`\<`void`\>

Defined in: [base.ts:267](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L267)

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

[`XmlSchema`](#abstract-xmlschema).[`writeToStream`](#writetostream-4)

##### writeSync()

> **writeSync**(`data`, `options?`): `string`

Defined in: [base.ts:281](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L281)

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

[`XmlSchema`](#abstract-xmlschema).[`writeSync`](#writesync-4)

##### writer()

> **writer**(`config`): `this`

Defined in: [base.ts:290](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L290)

Configure writer settings for this schema

###### Parameters

###### config

`XmlElementWriteConfig`

Writer configuration

###### Returns

`this`

This schema with writer config

###### Inherited from

[`XmlSchema`](#abstract-xmlschema).[`writer`](#writer-4)

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

##### transformFn

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

Defined in: [base.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L26)

###### Inherited from

`XmlSchemaBase._output`

##### \_input

> `readonly` **\_input**: `Input`

Defined in: [base.ts:27](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L27)

###### Inherited from

`XmlSchemaBase._input`

##### writeConfig?

> `protected` `optional` **writeConfig?**: `XmlElementWriteConfig`

Defined in: [base.ts:39](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L39)

**`Internal`**

Writer configuration for this schema

###### Inherited from

`XmlSchemaBase.writeConfig`

##### \_createTransform

> `static` **\_createTransform**: \<`Output`, `Input`, `NewOutput`\>(`schema`, `fn`) => `XmlSchemaBase`\<`NewOutput`, `Input`\>

Defined in: [base.ts:296](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L296)

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

##### \_createOptional

> `static` **\_createOptional**: \<`T`\>(`schema`) => `XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

Defined in: [base.ts:297](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L297)

###### Type Parameters

###### T

`T` *extends* `XmlSchemaBase`\<`unknown`, `unknown`\>

###### Parameters

###### schema

`T`

###### Returns

`XmlSchemaBase`\<`T`\[`"_output"`\] \| `undefined`, `T`\[`"_input"`\] \| `undefined`\>

###### Inherited from

`XmlSchemaBase._createOptional`

##### \_createArray

> `static` **\_createArray**: \<`T`\>(`schema`, `xpath?`) => `XmlSchemaBase`\<`T`\[`"_output"`\][], `T`\[`"_input"`\][]\>

Defined in: [base.ts:298](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L298)

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

##### \_createCompiled

> `static` **\_createCompiled**: \<`Output`, `Input`\>(`schema`) => `XmlSchemaBase`\<`Output`, `Input`\>

Defined in: [base.ts:299](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L299)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### Returns

`XmlSchemaBase`\<`Output`, `Input`\>

###### Inherited from

`XmlSchemaBase._createCompiled`

##### \_tryParseWithCompiledPlan?

> `static` `optional` **\_tryParseWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `AutoParseResult`\<`Output`\>

Defined in: [base.ts:300](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L300)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`AutoParseResult`\<`Output`\>

###### Inherited from

`XmlSchemaBase._tryParseWithCompiledPlan`

##### \_tryParseAsyncWithCompiledPlan?

> `static` `optional` **\_tryParseAsyncWithCompiledPlan?**: \<`Output`, `Input`\>(`schema`, `input`, `options?`) => `Promise`\<`AutoParseResult`\<`Output`\>\>

Defined in: [base.ts:305](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L305)

###### Type Parameters

###### Output

`Output`

###### Input

`Input`

###### Parameters

###### schema

`XmlSchemaBase`\<`Output`, `Input`\>

###### input

[`ParseInput`](#parseinput)

###### options?

[`ParseOptions`](#parseoptions)

###### Returns

`Promise`\<`AutoParseResult`\<`Output`\>\>

###### Inherited from

`XmlSchemaBase._tryParseAsyncWithCompiledPlan`

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

`AsyncIterator`\<`AnyXmlEvent`, `any`, `any`\> \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

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

Defined in: [base.ts:112](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L112)

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

Defined in: [base.ts:130](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L130)

Parse XML synchronously (public API)

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

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

`XmlSchemaBase.parseSync`

##### safeParse()

> **safeParse**(`input`, `options?`): `Promise`\<[`ParseResult`](#parseresult)\<`Output`\>\>

Defined in: [base.ts:147](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L147)

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

Defined in: [base.ts:168](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L168)

Parse XML synchronously with error handling

###### Parameters

###### input

`string` \| `Iterator`\<`AnyXmlEvent`, `any`, `any`\>

XML string or sync iterator

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

Defined in: [base.ts:188](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L188)

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

> **optional**(): `XmlSchemaBase`\<`Output` \| `undefined`, `Input` \| `undefined`\>

Defined in: [base.ts:196](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L196)

Make this schema optional

###### Returns

`XmlSchemaBase`\<`Output` \| `undefined`, `Input` \| `undefined`\>

New optional schema

###### Inherited from

`XmlSchemaBase.optional`

##### array()

> **array**(`xpath?`): `XmlSchemaBase`\<`Output`[], `Input`[]\>

Defined in: [base.ts:205](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L205)

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

##### compile()

> **compile**(): `XmlSchemaBase`\<`Output`, `Input`\>

Defined in: [base.ts:233](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L233)

Compile this schema for repeated parsing.

###### Returns

`XmlSchemaBase`\<`Output`, `Input`\>

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

`XmlSchemaBase.compile`

##### write()

> **write**(`data`, `options?`): `Promise`\<`string`\>

Defined in: [base.ts:244](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L244)

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

Defined in: [base.ts:267](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L267)

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

Defined in: [base.ts:281](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L281)

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

Defined in: [base.ts:290](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L290)

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

> `optional` **trimText?**: `boolean`

Defined in: [types.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L14)

Whether to trim whitespace from text content

###### Default Value

```ts
false
```

##### decodeEntities?

> `optional` **decodeEntities?**: `boolean`

Defined in: [types.ts:20](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L20)

Whether to decode XML entities

###### Default Value

```ts
true
```

##### strict?

> `optional` **strict?**: `boolean`

Defined in: [types.ts:26](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L26)

Strict mode for parsing

###### Default Value

```ts
false
```

##### maxDepth?

> `optional` **maxDepth?**: `number`

Defined in: [types.ts:32](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L32)

Maximum XML depth

###### Default Value

```ts
1000
```

##### maxEvents?

> `optional` **maxEvents?**: `number`

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

> `optional` **xpath?**: `string`

Defined in: [types.ts:50](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L50)

XPath expression to locate the element

##### min?

> `optional` **min?**: `number`

Defined in: [types.ts:55](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L55)

Minimum string length

##### max?

> `optional` **max?**: `number`

Defined in: [types.ts:60](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L60)

Maximum string length

##### pattern?

> `optional` **pattern?**: `RegExp`

Defined in: [types.ts:65](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L65)

Regular expression pattern to validate against

***

### XmlNumberOptions

Defined in: [types.ts:73](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L73)

Options for number schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: [types.ts:77](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L77)

XPath expression to locate the element

##### min?

> `optional` **min?**: `number`

Defined in: [types.ts:82](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L82)

Minimum value

##### max?

> `optional` **max?**: `number`

Defined in: [types.ts:87](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L87)

Maximum value

##### int?

> `optional` **int?**: `boolean`

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

> `optional` **xpath?**: `string`

Defined in: [types.ts:105](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L105)

XPath expression to locate the element

##### strict?

> `optional` **strict?**: `boolean`

Defined in: [types.ts:111](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/types.ts#L111)

Strict mode - reject unknown properties

###### Default Value

```ts
false
```

## Type Aliases

### XmlObjectShape

> **XmlObjectShape** = `Record`\<`string`, [`XmlSchema`](#abstract-xmlschema)\<`unknown`, `unknown`\>\>

Defined in: [XmlObjectSchema.ts:42](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L42)

Shape type for object schema

***

### InferObjectOutput

> **InferObjectOutput**\<`T`\> = `{ [K in keyof T]: T[K]["_output"] }`

Defined in: [XmlObjectSchema.ts:49](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlObjectSchema.ts#L49)

Infer output type from object shape

#### Type Parameters

##### T

`T` *extends* [`XmlObjectShape`](#xmlobjectshape)

***

### ParseInput

> **ParseInput** = `string` \| `ReadableStream`\<`Uint8Array`\> \| `AsyncIterator`\<`AnyXmlEvent`\> \| `Iterator`\<`AnyXmlEvent`\>

Defined in: [base.ts:14](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/base.ts#L14)

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

Defined in: [index.ts:72](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/index.ts#L72)

#### Type Parameters

##### T

`T` *extends* [`XmlSchema`](#abstract-xmlschema)\<`unknown`, `unknown`\>

## Variables

### x

> `const` **x**: [`XmlBuilder`](#xmlbuilder)

Defined in: [XmlBuilder.ts:58](https://github.com/Clickin/stax-xml/blob/master/packages/stax-xml/src/converter/XmlBuilder.ts#L58)

Singleton builder instance
