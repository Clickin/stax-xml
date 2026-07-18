---
title: Converter - XML 쓰기
description: v1 Converter Writer API로 JavaScript 값을 XML로 직렬화
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/writing-xml.png
slug: ko/v1.0.0/converter/writing-xml
---

Converter 쓰기는 공개 v1 기능입니다. `.writer()`로 XML 이름을 설정한 뒤
`.writeSync()`, `.write()`, `.writeToStream()`을 호출합니다.

```ts
import { x } from 'stax-xml/converter';

const catalog = x.object({
  id: x.string('./@id').writer({ asAttribute: 'id' }),
  owner: x.object({
    name: x.string('./name').writer({ element: 'name' }),
  }).writer({ element: 'owner' }),
  books: x.array(
    x.object({
      title: x.string('./title').writer({ element: 'title' }),
    }).writer({ element: 'book' }),
  ).writer({ element: 'books' }),
});

const data = {
  id: 'c1',
  owner: { name: 'Ada' },
  books: [{ title: 'One' }, { title: 'Two' }],
};

const xml = catalog.writeSync(data, {
  rootElement: 'catalog',
  includeDeclaration: false,
});
// <catalog id="c1"><owner><name>Ada</name></owner><books><book><title>One</title></book><book><title>Two</title></book></books></catalog>
```

Object의 `undefined`와 `null` field는 생략됩니다. Attribute field는 포함하는 object
element에 붙습니다. Element field가 `element`를 생략하면 field key를 사용합니다.
비어 있지 않은 array output에는 element schema의 item element 이름이 필요합니다.
`rootElement`는 선택적인 바깥 wrapper이며 top-level schema의 자체 `element`는 그 안에
유지됩니다.

```ts
interface XmlElementWriteConfig {
  element?: string;
  asAttribute?: string;
  namespace?: { prefix?: string; uri: string };
  cdata?: boolean;
  selfClosing?: boolean;
  comment?: string;
}

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

Namespace prefix를 생략하면 default namespace를 선언합니다. Prefix가 있는 element와
attribute는 XML Namespaces 규칙에 따라 URI를 선언하고 사용합니다. 예약 binding,
선언하지 않은 prefix, 잘못된 NCName, 중복 expanded attribute는 거부합니다.

`cdata`는 string scalar에 적용됩니다. `selfClosing`은 설정한 element가 비었을 때만
`/>`를 출력합니다. String content는 한 번만 escape하며 모든 structured writer input은
XML 1.0 금지 문자를 거부합니다.

v1 parser와 writer는 XML 1.0을 지원합니다. Reader byte input은 host가 지원하는
`TextDecoder` encoding을 선택할 수 있습니다. Built-in string/byte writer target은 UTF-8을
사용하며, 주입한 `AsyncTextSink` 또는 encoded `WriterSyncSink`는 외부 encoding을 선언할 수
있습니다. 불일치하는 encoding과 XML 1.1 선언은 거부합니다. 동기와 비동기 converter writer는 같은 구조와 검증 의미론을 갖습니다.

```ts
await catalog.writeToStream(data, writableStream, {
  rootElement: 'catalog',
  includeDeclaration: true,
});
```

Transform은 일반적으로 역변환할 수 없으므로 transform schema는 쓸 수 없습니다. Number
writer는 `NaN`과 infinity를 거부합니다. Low-level `writeRaw()`는 신뢰할 수 있는 XML에만
사용하며 converter scalar writer는 검증된 character 또는 CDATA method를 사용합니다.
