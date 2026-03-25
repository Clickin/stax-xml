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
  StaxXmlCursorSync,
  type StaxXmlCursorSyncOptions,
} from './StaxXmlCursorSync';

export type { StaxXmlCursorSyncOptions };

export class StaxXmlParserSync implements Iterable<AnyXmlEvent>, Iterator<AnyXmlEvent> {
  private readonly cursor: StaxXmlCursorSync;
  private done = false;

  constructor(xml: string, options: StaxXmlCursorSyncOptions = {}) {
    this.cursor = new StaxXmlCursorSync(xml, options);
  }

  public [Symbol.iterator](): Iterator<AnyXmlEvent> {
    return this;
  }

  public next(): IteratorResult<AnyXmlEvent> {
    if (this.done) {
      return { value: undefined, done: true };
    }

    try {
      const tokenType = this.cursor.next();
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
          this.cursor.getAttributesWithPrefix()
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
}

export default StaxXmlParserSync;
