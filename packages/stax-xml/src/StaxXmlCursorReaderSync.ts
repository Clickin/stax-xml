import { StaxXmlParserSync, StaxXmlParserSyncOptions } from './StaxXmlParserSync';
import { AnyXmlEvent, XmlCursorReaderSyncLike } from './types';
import { XmlCursorEvent } from './XmlCursorEvent';

export interface StaxXmlCursorReaderSyncOptions extends StaxXmlParserSyncOptions {}

export class StaxXmlCursorReaderSync implements XmlCursorReaderSyncLike {
  private readonly iterator: Iterator<AnyXmlEvent>;
  private buffer: IteratorResult<AnyXmlEvent> | null = null;
  private finished: boolean = false;
  private current: XmlCursorEvent | null = null;

  constructor(xml: string, options: StaxXmlCursorReaderSyncOptions = {}) {
    this.iterator = new StaxXmlParserSync(xml, options);
  }

  hasNext(): boolean {
    if (this.finished) {
      return false;
    }

    if (this.buffer !== null) {
      return !this.buffer.done;
    }

    this.buffer = this.iterator.next();
    return !this.buffer.done;
  }

  read(): boolean {
    if (this.finished) {
      this.current = null;
      return false;
    }

    const result = this.buffer ?? this.iterator.next();
    this.buffer = null;

    if (result.done) {
      this.finished = true;
      this.current = null;
      return false;
    }

    this.current = new XmlCursorEvent(result.value);
    return true;
  }

  getEvent(): XmlCursorEvent | null {
    return this.current;
  }

  requireEvent(): XmlCursorEvent {
    if (!this.current) {
      throw new Error('No active cursor event. Call read() first.');
    }

    return this.current;
  }
}

export function createStaxXmlCursorReaderSync(
  xml: string,
  options: StaxXmlCursorReaderSyncOptions = {}
): StaxXmlCursorReaderSync {
  return new StaxXmlCursorReaderSync(xml, options);
}
