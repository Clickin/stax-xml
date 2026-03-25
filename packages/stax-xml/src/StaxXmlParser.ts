import {
  type AnyXmlEvent,
  type EndDocumentEvent,
  type EndElementEvent,
  type ErrorEvent,
  type StartDocumentEvent,
  type StartElementEvent,
  XmlEventFactory,
  XmlEventType,
} from './types';
import {
  StaxXmlCursor,
  type StaxXmlCursorOptions as StaxXmlParserOptions,
} from './StaxXmlCursor';

export type { StaxXmlParserOptions };

export class StaxXmlParser implements AsyncIterator<AnyXmlEvent> {
  private readonly cursor: StaxXmlCursor;
  private readonly options: StaxXmlParserOptions;
  private done = false;

  constructor(xmlStream: ReadableStream<Uint8Array>, options: StaxXmlParserOptions = {}) {
    this.options = {
      batchSize: 10,
      batchTimeout: 10,
      ...options,
    };
    this.cursor = new StaxXmlCursor(xmlStream, this.options);
  }

  public async next(): Promise<IteratorResult<AnyXmlEvent>> {
    if (this.done) {
      return { value: undefined, done: true };
    }

    try {
      const tokenType = await this.cursor.next();
      const event = this.materializeEvent(tokenType);
      if (tokenType === XmlEventType.END_DOCUMENT) {
        this.done = true;
      }
      return {
        value: event,
        done: false,
      };
    } catch (error) {
      this.done = true;
      return {
        value: XmlEventFactory.error(error as Error) as ErrorEvent,
        done: false,
      };
    }
  }

  public async nextBatch(size?: number): Promise<AnyXmlEvent[]> {
    const batch: AnyXmlEvent[] = [];
    const targetSize = size ?? 1;
    const timeout = this.options.batchTimeout ?? 10;
    const startedAt = Date.now();

    for (let i = 0; i < targetSize; i++) {
      if (Date.now() - startedAt > timeout) {
        break;
      }

      const result = await this.next();
      if (result.done) {
        break;
      }

      batch.push(result.value);
      if (result.value.type === XmlEventType.ERROR) {
        break;
      }
    }

    return batch;
  }

  public async *batchedIterator(batchSize?: number): AsyncGenerator<AnyXmlEvent[]> {
    while (!this.done) {
      const batch = await this.nextBatch(batchSize);
      if (batch.length === 0) {
        break;
      }
      yield batch;
    }
  }

  public [Symbol.asyncIterator](): AsyncIterator<AnyXmlEvent> {
    return this;
  }

  public get XmlEventType(): typeof XmlEventType {
    return XmlEventType;
  }

  private materializeEvent(tokenType: XmlEventType): AnyXmlEvent {
    switch (tokenType) {
      case XmlEventType.START_DOCUMENT:
        return XmlEventFactory.startDocument() as StartDocumentEvent;
      case XmlEventType.END_DOCUMENT:
        return XmlEventFactory.endDocument() as EndDocumentEvent;
      case XmlEventType.START_ELEMENT:
        return XmlEventFactory.startElement(
          this.cursor.name,
          this.cursor.localName,
          this.cursor.prefix,
          this.cursor.uri,
          this.cursor.getAttributes(),
          this.toLegacyAsyncAttributesWithPrefix()
        ) as StartElementEvent;
      case XmlEventType.END_ELEMENT:
        return XmlEventFactory.endElement(
          this.cursor.name,
          this.cursor.localName,
          this.cursor.prefix,
          this.cursor.uri
        ) as EndElementEvent;
      case XmlEventType.CHARACTERS:
        return XmlEventFactory.characters(this.cursor.getText());
      case XmlEventType.CDATA:
        return XmlEventFactory.cdata(this.cursor.getText());
      case XmlEventType.ERROR:
        return XmlEventFactory.error(new Error('Cursor should not emit ERROR tokens.'));
      default:
        throw new Error(`Unsupported token type: ${String(tokenType)}`);
    }
  }

  private toLegacyAsyncAttributesWithPrefix(): Record<string, { value: string; prefix?: string; uri?: string }> {
    const attributesWithPrefix = this.cursor.getAttributesWithPrefix();
    return Object.fromEntries(
      Object.values(attributesWithPrefix).map((attribute) => [
        attribute.localName,
        {
          value: attribute.value,
          prefix: attribute.prefix,
          uri: attribute.uri,
        },
      ])
    );
  }
}

export default StaxXmlParser;
