import { describe, expect, it } from "vitest";
import {
  NEED_INPUT,
  JsTokenCursor,
  TokenCursorConsumer,
  XmlEventType,
  attributeValueOf,
  checkTokenBatchLimits,
} from "stax-xml-core";

describe("TokenCursor SPI v2", () => {
  it("publishes a first singleton and stable subsequent batch views", () => {
    const producer = new JsTokenCursor('<r a="1">text</r>', true);
    expect(() => producer.batch.select(0)).toThrow(/invalid token batch index/i);
    expect(producer.fillBatch()).toBe(1);
    expect(() => producer.fillBatch()).toThrow(/selected before refill/i);

    const consumer = new TokenCursorConsumer(new JsTokenCursor('<r a="1">text</r>', true));
    expect(consumer.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(consumer.next()).toBe(XmlEventType.START_ELEMENT);
    const view = consumer.current;
    expect(view.name()).toBe("r");
    expect(view.attributeName(0)).toBe("a");
    expect(view.attributeValue(0)).toBe("1");
    expect(consumer.next()).toBe(XmlEventType.CHARACTERS);
    expect(view.text()).toBe("text");
    expect(consumer.next()).toBe(XmlEventType.END_ELEMENT);
    expect(consumer.next()).toBe(XmlEventType.END_DOCUMENT);
    expect(consumer.next()).toBeNull();
  });

  it("keeps input supply outside the producer and preserves NEED_INPUT ordering", () => {
    const producer = new JsTokenCursor("", false);
    const consumer = new TokenCursorConsumer(producer);
    expect(consumer.next()).toBe(NEED_INPUT);
    producer.push("<r/>", true);
    expect(consumer.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(consumer.next()).toBe(XmlEventType.START_ELEMENT);
    expect(consumer.next()).toBe(XmlEventType.END_ELEMENT);
    expect(consumer.next()).toBe(XmlEventType.END_DOCUMENT);
    consumer.close();
    expect(consumer.next()).toBeNull();
    producer.dispose();
    expect(producer.fillBatch()).toBeNull();

    const options = {};
    Object.defineProperty(options, Symbol.for("stax-xml.experimental.tokenBatchSize"), { value: 8 });
    const partial = new JsTokenCursor("<r/>", false, options);
    const partialConsumer = new TokenCursorConsumer(partial);
    expect(partialConsumer.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(partialConsumer.next()).toBe(XmlEventType.START_ELEMENT);
    expect(partialConsumer.next()).toBe(XmlEventType.END_ELEMENT);
    expect(partialConsumer.next()).toBe(NEED_INPUT);
  });

  it("rejects input while either slot still has unconsumed tokens", () => {
    const unselected = new JsTokenCursor("<r/>", false);
    expect(unselected.fillBatch()).toBe(1);
    expect(() => unselected.push(" ")).toThrow(/batch is pending/i);

    const selectedOptions = {};
    Object.defineProperty(selectedOptions, Symbol.for("stax-xml.experimental.tokenBatchSize"), { value: 8 });
    const selected = new JsTokenCursor("<r/><s/>", false, selectedOptions);
    expect(selected.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(selected.next()).toBe(XmlEventType.START_ELEMENT);
    expect(selected.next()).toBe(XmlEventType.END_ELEMENT);
    expect(() => selected.push(" ")).toThrow(/batch is pending/i);
  });

  it("defers a parse error found after a published batch", () => {
    const options = {};
    Object.defineProperty(options, Symbol.for("stax-xml.experimental.tokenBatchSize"), { value: 8 });
    const producer = new JsTokenCursor("<r><ok/></wrong>", true, options);
    const consumer = new TokenCursorConsumer(producer);
    expect(consumer.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(consumer.next()).toBe(XmlEventType.START_ELEMENT);
    expect(consumer.next()).toBe(XmlEventType.START_ELEMENT);
    expect(consumer.next()).toBe(XmlEventType.END_ELEMENT);
    expect(() => consumer.next()).toThrow(/mismatched end tag/i);

    const closedProducer = new JsTokenCursor("<r><ok/></wrong>", true, options);
    const closedConsumer = new TokenCursorConsumer(closedProducer);
    expect(closedConsumer.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(closedConsumer.next()).toBe(XmlEventType.START_ELEMENT);
    closedConsumer.close();
    closedProducer.dispose();
  });

  it("keeps indexed, qualified, and expanded-name attribute lookup behavior", () => {
    const producer = new JsTokenCursor('<r xmlns:p="urn:p" p:id="7" plain="x"/>', true);
    const consumer = new TokenCursorConsumer(producer);
    expect(consumer.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(consumer.next()).toBe(XmlEventType.START_ELEMENT);
    const view = consumer.current;
    expect(attributeValueOf(view, 1)).toBe("7");
    expect(attributeValueOf(view, "plain")).toBe("x");
    expect(attributeValueOf(view, "urn:p", "id")).toBe("7");
    expect(attributeValueOf(view, "missing")).toBeUndefined();
    expect(attributeValueOf(view, "urn:none", "id")).toBeUndefined();
  });

  it("validates limits and experimental batch-size overrides", () => {
    checkTokenBatchLimits({ maxTokens: 1, maxAttributes: 1, maxScanBytes: 1, maxTransientBytes: 1 });
    expect(() => checkTokenBatchLimits({ maxTokens: 0, maxAttributes: 1, maxScanBytes: 1, maxTransientBytes: 1 })).toThrow(/limits/i);
    const options = {};
    Object.defineProperty(options, Symbol.for("stax-xml.experimental.tokenBatchSize"), { value: 8 });
    const producer = new JsTokenCursor("<r/>", true, options);
    expect(producer.fillBatch()).toBe(1);
    expect(producer.batch.select(0)).toBe(XmlEventType.START_DOCUMENT);
  });

  it("keeps the internal concrete cursor shim on the selected view only", () => {
    const producer = new JsTokenCursor('<r a="x"/>', true);
    expect(producer.fillBatch()).toBe(1);
    expect(producer.batch.current.eventType()).toBe(XmlEventType.START_DOCUMENT);
    expect(producer.batch.current.attributeCount()).toBe(0);
    expect(producer.batch.current.selfClosing()).toBe(false);
    expect(producer.batch.fillTarget()).toBe(0);
    expect(producer.next()).toBe(XmlEventType.START_DOCUMENT);
    expect(producer.next()).toBe(XmlEventType.START_ELEMENT);
    expect(producer.eventType()).toBe(XmlEventType.START_ELEMENT);
    expect(producer.name()).toBe("r");
    expect(producer.localName()).toBe("r");
    expect(producer.prefix()).toBe("");
    expect(producer.namespaceURI()).toBe("");
    expect(producer.attributeCount()).toBe(1);
    expect(producer.attributeName(0)).toBe("a");
    expect(producer.attributeLocalName(0)).toBe("a");
    expect(producer.attributePrefix(0)).toBe("");
    expect(producer.attributeNamespaceURI(0)).toBe("");
    expect(producer.attributeValue(0)).toBe("x");
    expect(producer.selfClosing()).toBe(true);
    expect(producer.documentDeclaration()).toBeUndefined();
    expect(producer.namespaceURIForPrefix("missing")).toBe("");
    expect(producer.attribute(0)?.value).toBe("x");
    expect(producer.attribute("a")?.value).toBe("x");
  });

  it("rejects an invalid producer batch count", () => {
    const producer = new JsTokenCursor("", true);
    producer.fillBatch = () => 0;
    expect(() => new TokenCursorConsumer(producer).next()).toThrow(/batch size/i);
  });

  it("grows the reusable token slot without changing token order", () => {
    const options = {};
    Object.defineProperty(options, Symbol.for("stax-xml.experimental.tokenBatchSize"), { value: 32 });
    const producer = new JsTokenCursor("<r/>".repeat(16), true, options);
    const consumer = new TokenCursorConsumer(producer);
    expect(consumer.next()).toBe(XmlEventType.START_DOCUMENT);
    let starts = 0;
    for (let type = consumer.next(); type !== null; type = consumer.next())
      if (type === XmlEventType.START_ELEMENT) starts++;
    expect(starts).toBe(16);
  });
});
