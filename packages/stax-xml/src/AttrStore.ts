import { AttributeInfo, StartElementEvent } from './types';
import { CursorAttribute } from './types';

function parseAttributeName(name: string): Pick<CursorAttribute, 'localName' | 'prefix'> {
  const colonIndex = name.indexOf(':');
  if (colonIndex === -1) {
    return { localName: name, prefix: undefined };
  }

  return {
    prefix: name.slice(0, colonIndex),
    localName: name.slice(colonIndex + 1)
  };
}

export class AttrStore {
  private readonly list: CursorAttribute[];

  constructor(startEvent: StartElementEvent) {
    this.list = AttrStore.fromEvent(startEvent);
  }

  get count(): number {
    return this.list.length;
  }

  getByIndex(index: number): CursorAttribute | undefined {
    return this.list[index];
  }

  getByName(name: string): CursorAttribute | undefined {
    return this.list.find((attr) => attr.name === name);
  }

  toArray(): CursorAttribute[] {
    return this.list;
  }

  private static fromEvent(event: StartElementEvent): CursorAttribute[] {
    if (event.attributesWithPrefix) {
      return Object.entries(event.attributesWithPrefix).map(([name, info]) => {
        const typedInfo = info as AttributeInfo;
        return {
          name,
          localName: typedInfo.localName,
          prefix: typedInfo.prefix,
          uri: typedInfo.uri,
          value: typedInfo.value
        } satisfies CursorAttribute;
      });
    }

    return Object.entries(event.attributes).map(([name, value]) => {
      const parsedName = parseAttributeName(name);
      return {
        name,
        localName: parsedName.localName,
        prefix: parsedName.prefix,
        uri: undefined,
        value
      } satisfies CursorAttribute;
    });
  }
}
