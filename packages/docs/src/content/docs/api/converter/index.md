---
title: stax-xml
description: API reference for stax-xml
---

**stax-xml**

***

# stax-xml

## Classes

### XmlParseError

Defined in: errors.ts:6

XML parse error with detailed issue information

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new XmlParseError**(`issues`): [`XmlParseError`](#xmlparseerror)

Defined in: errors.ts:16

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

Defined in: errors.ts:10

List of validation issues

###### path

> **path**: `string`[]

###### message

> **message**: `string`

###### code

> **code**: `string`

## Interfaces

### ParseOptions

Defined in: types.ts:10

Parse options for XML converter

#### Properties

##### trimText?

> `optional` **trimText?**: `boolean`

Defined in: types.ts:15

Whether to trim whitespace from text content

###### Default Value

```ts
true
```

##### documentMode?

> `optional` **documentMode?**: `DocumentMode`

Defined in: types.ts:22

XML document conformance mode.

###### Default Value

```ts
'document'
```

##### maxDepth?

> `optional` **maxDepth?**: `number`

Defined in: types.ts:28

Maximum XML depth

###### Default Value

```ts
Infinity
```

##### maxEvents?

> `optional` **maxEvents?**: `number`

Defined in: types.ts:34

Maximum number of events to process

###### Default Value

```ts
Infinity
```

***

### XmlStringOptions

Defined in: types.ts:43

Options for string schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: types.ts:47

XPath expression to locate the element

***

### XmlNumberOptions

Defined in: types.ts:56

Options for number schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: types.ts:60

XPath expression to locate the element

##### min?

> `optional` **min?**: `number`

Defined in: types.ts:65

Minimum value

##### max?

> `optional` **max?**: `number`

Defined in: types.ts:70

Maximum value

##### int?

> `optional` **int?**: `boolean`

Defined in: types.ts:76

Whether the number must be an integer

###### Default Value

```ts
false
```

***

### XmlObjectOptions

Defined in: types.ts:84

Options for object schema

#### Properties

##### xpath?

> `optional` **xpath?**: `string`

Defined in: types.ts:88

XPath expression to locate the element

***

### XmlElementWriteConfig

Defined in: types.ts:97

Writer configuration for XML element

#### Properties

##### element

> **element**: `string`

Defined in: types.ts:101

Element name (required)

##### asAttribute?

> `optional` **asAttribute?**: `string`

Defined in: types.ts:107

Write as attribute instead of element
Value is the attribute name

##### namespace?

> `optional` **namespace?**: `object`

Defined in: types.ts:112

Namespace configuration

###### prefix?

> `optional` **prefix?**: `string`

Namespace prefix (e.g., 'dc', 'xsi')

###### uri?

> `optional` **uri?**: `string`

Namespace URI (e.g., 'http://purl.org/dc/elements/1.1/')

##### cdata?

> `optional` **cdata?**: `boolean`

Defined in: types.ts:128

Wrap content in CDATA section

###### Default Value

```ts
false
```

##### selfClosing?

> `optional` **selfClosing?**: `boolean`

Defined in: types.ts:134

Use self-closing tag for empty elements

###### Default Value

```ts
false
```

##### comment?

> `optional` **comment?**: `string`

Defined in: types.ts:139

Add XML comment before element

***

### XmlWriteOptions

Defined in: types.ts:147

Options for XML writer

#### Properties

##### prettyPrint?

> `optional` **prettyPrint?**: `boolean`

Defined in: types.ts:152

Format output with indentation

###### Default Value

```ts
false
```

##### indentString?

> `optional` **indentString?**: `string`

Defined in: types.ts:158

Indentation string

###### Default Value

```ts
'  '
```

##### encoding?

> `optional` **encoding?**: `"utf-8"` \| `"UTF-8"`

Defined in: types.ts:164

Text encoding for output

###### Default Value

```ts
'utf-8'
```

##### rootElement?

> `optional` **rootElement?**: `string`

Defined in: types.ts:170

Root element name
If not provided, no root element wrapper is added

##### includeDeclaration?

> `optional` **includeDeclaration?**: `boolean`

Defined in: types.ts:176

Include XML declaration

###### Default Value

```ts
true
```

##### xmlVersion?

> `optional` **xmlVersion?**: `string`

Defined in: types.ts:182

XML version for declaration

###### Default Value

```ts
'1.0'
```

##### writer?

> `optional` **writer?**: `Writer` \| `WriterSync` \| `WriterSyncSink`

Defined in: types.ts:190

Custom writer instance
- WriterSync: for writeSync() method
- WriterSyncSink: for writeSync() with custom sink
- Writer: for write() async method

## Type Aliases

### ParseInput

> **ParseInput** = `string` \| `Uint8Array` \| `Iterable`\<`Uint8Array`\> \| `Iterable`\<readonly `Uint8Array`[]\> \| `Iterable`\<`AnyXmlEvent`\> \| `AsyncIterable`\<`Uint8Array`\> \| `AsyncIterable`\<readonly `Uint8Array`[]\> \| `AsyncIterable`\<`AnyXmlEvent`\> \| `ReadableStream`\<`Uint8Array`\>

Defined in: base.ts:11

Parse input type for XML text, byte chunks, or materialized StAX events.

***

### ParseResult

> **ParseResult**\<`T`\> = \{ `success`: `true`; `data`: `T`; \} \| \{ `success`: `false`; `error`: [`XmlParseError`](#xmlparseerror); \}

Defined in: errors.ts:28

Parse result type for safe parsing operations

#### Type Parameters

##### T

`T`

***

### Infer

> **Infer**\<`T`\> = `T`\[`"_output"`\]

Defined in: index.ts:58

#### Type Parameters

##### T

`T` *extends* `XmlSchema`\<`unknown`, `unknown`\>

## Variables

### x

> `const` **x**: `XmlBuilder`

Defined in: XmlBuilder.ts:58

Singleton builder instance
