---
title: Converter - XML 쓰기
description: 공개 Converter Writer API로 JavaScript 값을 XML로 직렬화
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/writing-xml.png
slug: ko/v1.1.0/converter/writing-xml
---

Parse 결과를 명확하게 XML로 표현할 수 있는 converter schema는 양방향으로 사용할 수
있습니다. `.writer()`로 element와 attribute 이름을 설정한 뒤 `.writeSync()`,
`.write()`, `.writeToStream()`을 호출합니다.

## Object 출력

```ts
import { x } from 'stax-xml/converter';

const book = x.object({
  id: x.string('./@id').writer({ asAttribute: 'id' }),
  title: x.string('./title').writer({ element: 'title' }),
  price: x.number('./price').writer({ element: 'price' }),
  note: x.string('./note').optional().writer({ element: 'note' }),
});

const xml = book.writeSync(
  { id: 'b1', title: 'XML & Streams', price: 29.5, note: undefined },
  { rootElement: 'book', includeDeclaration: false },
);
// <book id="b1"><title>XML &amp; Streams</title><price>29.5</price></book>
```

Object의 `undefined`와 `null` field는 생략됩니다. Attribute field는 해당 object를
감싸는 element에 기록됩니다. Element field가 `element`를 생략하면 object key를
element 이름으로 사용합니다.

## 중첩 object와 array

```ts
const catalog = x.object({
  owner: x.object({
    name: x.string('./name').writer({ element: 'name' }),
  }).writer({ element: 'owner' }),
  books: x.array(
    x.object({
      title: x.string('./title').writer({ element: 'title' }),
    }).writer({ element: 'book' }),
  ).writer({ element: 'books' }),
});

const xml = await catalog.write(
  { owner: { name: 'Ada' }, books: [{ title: 'One' }, { title: 'Two' }] },
  { rootElement: 'catalog', includeDeclaration: false },
);
// <catalog><owner><name>Ada</name></owner><books><book><title>One</title></book><book><title>Two</title></book></books></catalog>
```

Object field인 array schema의 `element`는 collection element 이름입니다. Array의
element schema에는 item element 이름이 필요합니다. Item 이름이 없는 비어 있지 않은
array는 거부합니다.

`rootElement`는 선택적인 바깥 wrapper입니다. Top-level schema에 자체 `element`를
설정했다면 그 element는 wrapper 안에 유지됩니다. `rootElement`를 생략하면 schema의
element 자체가 document element가 됩니다.

## Writer 설정

```ts
interface XmlElementWriteConfig {
  element?: string;
  asAttribute?: string;
  namespace?: {
    prefix?: string;
    uri: string;
  };
  cdata?: boolean;
  selfClosing?: boolean;
  comment?: string;
}
```

- `element`: element 이름. Object field는 field key를 대신 사용할 수 있습니다.
- `asAttribute`: field를 포함하는 object element의 attribute로 기록합니다.
- `namespace`: XML Namespaces 규칙으로 namespace를 선언합니다. Prefix를 생략하면
  default namespace입니다.
- `cdata`: string scalar를 CDATA로 기록합니다. `]]>`가 든 content는 거부합니다.
- `selfClosing`: 설정한 element가 비어 있을 때만 `/>`를 출력합니다.
- `comment`: element 앞에 검증된 XML comment를 기록합니다.

```ts
const value = x.string().writer({
  element: 'value',
  namespace: { prefix: 'm', uri: 'urn:metrics' },
});

value.writeSync('42', { rootElement: 'root', includeDeclaration: false });
// <root><m:value xmlns:m="urn:metrics">42</m:value></root>
```

Namespace prefix와 local name은 XML NCName으로 검증합니다. 예약된 `xml` / `xmlns`
binding, 선언하지 않은 prefix, 중복 expanded attribute는 거부합니다.

## 출력 option

```ts
interface XmlWriteOptions {
  prettyPrint?: boolean;
  indentString?: string;
  encoding?: 'utf-8' | 'UTF-8';
  rootElement?: string;
  includeDeclaration?: boolean;
  xmlVersion?: '1.0';
  writer?: WriterSync | WriterSyncSink | Writer;
}
```

v1 parser와 writer는 XML 1.0을 구현합니다. Reader byte input은 host가 지원하는
`TextDecoder` encoding을 선택할 수 있습니다. Built-in string/byte writer target은 UTF-8을
사용하며, 주입한 `AsyncTextSink` 또는 encoded `WriterSyncSink`는 외부 encoding을 선언할 수
있습니다. 불일치하는 encoding과 XML 1.1 선언은 거부합니다. Element text, attribute,
comment, CDATA, namespace URI, processing-instruction data에는 XML 1.0 금지 문자를 쓸 수
없습니다.

동기와 비동기 converter writer의 출력 의미론은 같습니다.

```ts
const options = { rootElement: 'book', includeDeclaration: false } as const;
const syncXml = book.writeSync(data, options);
const asyncXml = await book.write(data, options);
// syncXml === asyncXml
```

큰 출력은 string으로 모으지 말고 직접 stream합니다.

```ts
await catalog.writeToStream(data, writableStream, {
  rootElement: 'catalog',
  includeDeclaration: true,
});
```

## 지원하지 않는 출력

- Transform은 일반적으로 역변환할 수 없으므로 transform schema는 쓸 수 없습니다.
- Number writer는 `NaN`과 infinity를 거부합니다.
- Attribute field에는 이를 포함할 object element가 필요합니다.
- `writeRaw()`는 low-level writer에서 신뢰할 수 있는 XML에만 사용합니다. Converter
  scalar writer는 검증된 character 또는 CDATA method를 사용합니다.

Parsing은 [Schema Types](./schemas/), low-level streaming writer는
[Writer](../../api-guides/writer/)를 참고하세요.
