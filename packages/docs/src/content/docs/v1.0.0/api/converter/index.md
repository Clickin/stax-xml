---
title: stax-xml
description: API reference for stax-xml
slug: v1.0.0/api/converter
---

**stax-xml**

***

# stax-xml

## Classes

### XmlParseError

Defined in: index.d.ts:11

XML parse error with detailed issue information

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new XmlParseError**(`issues`): [`XmlParseError`](#xmlparseerror)

Defined in: index.d.ts:20

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

Defined in: index.d.ts:15

List of validation issues

###### path

> **path**: `string`[]

###### message

> **message**: `string`

###### code

> **code**: `string`

## Interfaces

### ParseOptions

Defined in: index.d.ts:201

Parse options for XML converter

#### Properties

##### trimText?

> `optional` **trimText?**: `boolean`

Defined in: index.d.ts:206

Whether to trim whitespace from text content

###### Default Value

```ts
true
```

##### documentMode?

> `optional` **documentMode?**: `DocumentMode`

Defined in: index.d.ts:212

XML document conformance mode.

###### Default Value

```ts
'document'
```

##### maxDepth?

> `optional` **maxDepth?**: `number`

Defined in: index.d.ts:217

Maximum XML depth

###### Default Value

```ts
Infinity
```

##### maxEvents?

> `optional` **maxEvents?**: `number`

Defined in: index.d.ts:222

Maximum number of events to process

###### Default Value

```ts
Infinity
```

***

### XmlStringOptions

Defined in: index.d.ts:229

Options for string schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: index.d.ts:233

XPath expression to locate the element

***

### XmlNumberOptions

Defined in: index.d.ts:240

Options for number schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: index.d.ts:244

XPath expression to locate the element

##### min?

> `optional` **min?**: `number`

Defined in: index.d.ts:248

Minimum value

##### max?

> `optional` **max?**: `number`

Defined in: index.d.ts:252

Maximum value

##### int?

> `optional` **int?**: `boolean`

Defined in: index.d.ts:257

Whether the number must be an integer

###### Default Value

```ts
false
```

***

### XmlObjectOptions

Defined in: index.d.ts:264

Options for object schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: index.d.ts:268

XPath expression to locate the element

***

### XmlElementWriteConfig

Defined in: index.d.ts:275

Writer configuration for XML element

#### Properties

##### element

> **element**: `string`

Defined in: index.d.ts:279

Element name (required)

##### asAttribute?

> `optional` **asAttribute?**: `string`

Defined in: index.d.ts:284

Write as attribute instead of element
Value is the attribute name

##### namespace?

> `optional` **namespace?**: `object`

Defined in: index.d.ts:288

Namespace configuration

###### prefix?

> `optional` **prefix?**: `string`

Namespace prefix (e.g., 'dc', 'xsi')

###### uri?

> `optional` **uri?**: `string`

Namespace URI (e.g., 'http://purl.org/dc/elements/1.1/')

##### cdata?

> `optional` **cdata?**: `boolean`

Defined in: index.d.ts:302

Wrap content in CDATA section

###### Default Value

```ts
false
```

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: index.d.ts:307

Use self-closing tag for empty elements

###### Default Value

```ts
false
```

##### comment?

> `optional` **comment?**: `string`

Defined in: index.d.ts:311

Add XML comment before element

***

### XmlWriteOptions

Defined in: index.d.ts:318

Options for XML writer

#### Properties

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: index.d.ts:323

Format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString?**: `string`

Defined in: index.d.ts:328

Indentation string

###### Default Value

```ts
'  '
```

##### encoding?

> `optional` **encoding?**: `"utf-8"` \| `"UTF-8"`

Defined in: index.d.ts:333

Text encoding for output

###### Default Value

```ts
'utf-8'
```

##### rootElement?

> `optional` **rootElement?**: `string`

Defined in: index.d.ts:338

Root element name
If not provided, no root element wrapper is added

##### includeDeclaration?

> `optional` **includeDeclaration?**: `boolean`

Defined in: index.d.ts:343

Include XML declaration

###### Default Value

```ts
true
```

##### xmlVersion?

> `optional` **xmlVersion?**: `string`

Defined in: index.d.ts:348

XML version for declaration

###### Default Value

```ts
'1.0'
```

##### writer?

> `optional` **writer?**: `WriterSync` \| `WriterSyncSink` \| `Writer`

Defined in: index.d.ts:355

Custom writer instance
- WriterSync: for writeSync() method
- WriterSyncSink: for writeSync() with custom sink
- Writer: for write() async method

## Type Aliases

### ParseResult

> **ParseResult**\<`T`\> = \{ `success`: `true`; `data`: `T`; \} \| \{ `success`: `false`; `error`: [`XmlParseError`](#xmlparseerror); \}

Defined in: index.d.ts:31

Parse result type for safe parsing operations

#### Type Parameters

##### T

`T`

***

### ParseInput

> **ParseInput** = `string` \| `Uint8Array` \| `Iterable`\<`Uint8Array`\> \| `Iterable`\<readonly `Uint8Array`[]\> \| `Iterable`\<`AnyXmlEvent`\> \| `AsyncIterable`\<`Uint8Array`\> \| `AsyncIterable`\<readonly `Uint8Array`[]\> \| `AsyncIterable`\<`AnyXmlEvent`\> \| `ReadableStream`\<`Uint8Array`\>

Defined in: index.d.ts:383

Parse input type for XML text, byte chunks, or materialized StAX events.

***

### Infer

> **Infer**\<`T`\> = `T`\[`"_output"`\]

Defined in: index.d.ts:565

#### Type Parameters

##### T

`T` *extends* `XmlSchema`\<`unknown`, `unknown`\>

## Variables

### x

> `const` **x**: `XmlBuilder`

Defined in: index.d.ts:562

Singleton builder instance
