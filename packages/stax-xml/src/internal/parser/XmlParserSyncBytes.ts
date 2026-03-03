import XmlParserCore from './XmlParserCore';
import type { XmlParserCoreOptions } from './XmlParserCore';
import type { AnyXmlEvent } from '../../types';

// A minimal, synchronous driver that feeds an Iterable<Uint8Array> or Iterator<Uint8Array>
// into XmlParserCore and yields events via nextEvent().
export class XmlParserSyncBytes {
  private readonly core: XmlParserCore;
  private iterator: Iterator<Uint8Array> | null;

  constructor(input: Iterable<Uint8Array> | Iterator<Uint8Array>, options: XmlParserCoreOptions = {}) {
    this.core = new XmlParserCore(options);
    if (typeof (input as any)[Symbol.iterator] === 'function') {
      this.iterator = (input as Iterable<Uint8Array>)[Symbol.iterator]();
    } else if (typeof (input as any).next === 'function') {
      this.iterator = input as Iterator<Uint8Array>;
    } else {
      throw new TypeError('XmlParserSyncBytes expects an Iterable<Uint8Array> or Iterator<Uint8Array>.');
    }
  }

  // Return the next Xml event, or null if finished.
  public nextEvent(): AnyXmlEvent | null {
    // Fast path: check if core already has a buffered event
    const buffered = this.core.nextEvent();
    if (buffered !== null) return buffered;

    // Consume chunks until an event is produced or input is exhausted
    while (true) {
      const iter = this.iterator!;
      const { value, done } = iter.next();
      if (done) {
        this.core.end();
        return this.core.nextEvent();
      }
      this.core.feed(value);
      const evt = this.core.nextEvent();
      if (evt !== null) return evt;
      // else loop to fetch next chunk
    }
  }
}

export default XmlParserSyncBytes;
