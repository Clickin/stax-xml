import { TokenCursor } from "../TokenCursor.js";
import {
  XmlEventType,
  type AnyXmlEvent,
  type EventAttribute,
  type EventAttributes,
  type XmlEventType as XmlEventTypeValue,
} from "../types.js";

class MaterializedEventAttributes
  extends Map<string, EventAttribute>
  implements EventAttributes
{
  toJSON(): Record<string, EventAttribute> {
    return Object.fromEntries(this);
  }
}

/** @internal Materialize one stable event from the cursor's current token. */
export function materializeTokenEvent(
  cursor: TokenCursor,
  type: XmlEventTypeValue = cursor.eventType(),
): AnyXmlEvent {
  let name: string | undefined;
  let localName: string | undefined;
  let prefix: string | undefined;
  let namespaceURI: string | undefined;
  let attributes: MaterializedEventAttributes | undefined;
  let selfClosing: boolean | undefined;
  let value: string | undefined;
  let target: string | undefined;
  let data: string | undefined;
  let version: "1.0" | undefined;
  let encoding: string | undefined;
  let standalone: boolean | undefined;

  if (type === XmlEventType.START_DOCUMENT) {
    ({ version, encoding, standalone } = cursor.documentDeclaration() ?? {});
  } else if (type === XmlEventType.START_ELEMENT) {
    name = cursor.name()!;
    localName = cursor.localName()!;
    prefix = cursor.prefix();
    namespaceURI = cursor.namespaceURI();
    selfClosing = cursor.selfClosing();
    const count = cursor.attributeCount();
    for (let index = 0; index < count; index++) {
      const attribute = cursor.attribute(index)!;
      (attributes ??= new MaterializedEventAttributes()).set(
        attribute.name,
        attribute,
      );
    }
  } else if (type === XmlEventType.END_ELEMENT) {
    name = cursor.name()!;
    localName = cursor.localName()!;
    prefix = cursor.prefix();
    namespaceURI = cursor.namespaceURI();
  } else if (
    type === XmlEventType.CHARACTERS ||
    type === XmlEventType.CDATA ||
    type === XmlEventType.COMMENT ||
    type === XmlEventType.DTD
  ) {
    value = cursor.text()!;
  } else if (type === XmlEventType.PROCESSING_INSTRUCTION) {
    target = cursor.name()!;
    data = cursor.text()!;
  }

  // One property order keeps a stable hidden class; absent event data uses
  // undefined rather than allocating placeholder collections or objects.
  return {
    type,
    name,
    localName,
    prefix,
    namespaceURI,
    attributes,
    selfClosing,
    value,
    target,
    data,
    version,
    encoding,
    standalone,
  } as unknown as AnyXmlEvent;
}
