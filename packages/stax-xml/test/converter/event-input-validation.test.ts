import { describe, expect, it } from "vitest";
import { XmlEventType, type AnyXmlEvent } from "stax-xml-core";
import { x } from "../../src/converter/converter/index.js";

const start = { type: XmlEventType.START_DOCUMENT } as const;
const end = { type: XmlEventType.END_DOCUMENT } as const;
const open = (name: string): AnyXmlEvent => ({
  type: XmlEventType.START_ELEMENT,
  name,
  localName: name,
  prefix: "",
  namespaceURI: "",
  selfClosing: false,
});
const close = (name: string): AnyXmlEvent => ({
  type: XmlEventType.END_ELEMENT,
  name,
  localName: name,
  prefix: "",
  namespaceURI: "",
});

describe("converter event input validation", () => {
  it.each([
    [
      "missing START_DOCUMENT",
      [open("root"), close("root"), end],
      /begin with START_DOCUMENT/,
    ],
    ["duplicate START_DOCUMENT", [start, start, end], /exactly once/],
    ["event after END_DOCUMENT", [start, end, start], /after END_DOCUMENT/],
    [
      "missing END_DOCUMENT",
      [start, open("root"), close("root")],
      /include START_DOCUMENT and END_DOCUMENT/,
    ],
    ["unclosed element", [start, open("root"), end], /unclosed element/i],
    ["unexpected close", [start, close("root"), end], /unexpected closing/i],
    [
      "second DTD",
      [
        start,
        { type: XmlEventType.DTD, value: "DOCTYPE root" },
        { type: XmlEventType.DTD, value: "DOCTYPE root" },
        end,
      ],
      /DOCTYPE/,
    ],
    [
      "DTD after root",
      [
        start,
        open("root"),
        close("root"),
        { type: XmlEventType.DTD, value: "DOCTYPE root" },
        end,
      ],
      /DOCTYPE/,
    ],
  ] as const)("%s", (_name, events, error) => {
    expect(() => x.string().parseSync(events as AnyXmlEvent[])).toThrow(error);
  });

  it("enforces document roots and outside-root character data", () => {
    expect(() =>
      x.string().parseSync([start, end], { documentMode: "document" }),
    ).toThrow(/exactly one root/);
    expect(() =>
      x
        .string()
        .parseSync(
          [
            start,
            { type: XmlEventType.CHARACTERS, value: "text" },
            open("root"),
            close("root"),
            end,
          ],
          { documentMode: "document" },
        ),
    ).toThrow(/character data/i);
    expect(() =>
      x
        .string()
        .parseSync(
          [
            start,
            { type: XmlEventType.CDATA, value: "" },
            open("root"),
            close("root"),
            end,
          ],
          { documentMode: "document" },
        ),
    ).toThrow(/character data/i);
  });

  it("enforces event-input depth and event limits through the shared runtime checks", () => {
    expect(() =>
      x
        .string("/root")
        .parseSync(
          [
            start,
            open("root"),
            open("nested"),
            close("nested"),
            close("root"),
            end,
          ],
          { maxDepth: 1 },
        ),
    ).toThrow(/depth limit/i);
    expect(() =>
      x.string("/root").parseSync([start, end], { maxEvents: 0 }),
    ).toThrow(/event limit/i);
  });

  it("accepts document whitespace and a single pre-root DTD", () => {
    const events: AnyXmlEvent[] = [
      start,
      { type: XmlEventType.CHARACTERS, value: " \n" },
      { type: XmlEventType.DTD, value: "DOCTYPE root" },
      open("root"),
      { type: XmlEventType.CHARACTERS, value: "value" },
      close("root"),
      end,
    ];
    expect(
      x.string("/root").parseSync(events, { documentMode: "document" }),
    ).toBe("value");
  });

  it("projects attributes from materialized event input", () => {
    const root = open("root");
    root.attributes = new Map([
      [
        "id",
        {
          name: "id",
          localName: "id",
          prefix: "",
          namespaceURI: "",
          value: "7",
        },
      ],
    ]);
    expect(
      x.string("/root/@id").parseSync([start, root, close("root"), end]),
    ).toBe("7");
    expect(
      x
        .string("/root/@missing")
        .parseSync([start, open("root"), close("root"), end]),
    ).toBe("");
  });

  it("accepts byte batches and async event iterables", async () => {
    const bytes = new TextEncoder().encode("<root>value</root>");
    const batches = [[bytes.slice(0, 5), bytes.slice(5)]];
    expect(x.string("/root").parseSync(batches)).toBe("value");

    async function* asyncBatches(): AsyncGenerator<readonly Uint8Array[]> {
      yield batches[0]!;
    }
    await expect(x.string("/root").parse(asyncBatches())).resolves.toBe(
      "value",
    );

    async function* asyncEvents(): AsyncGenerator<AnyXmlEvent> {
      yield start;
      yield open("root");
      yield { type: XmlEventType.CHARACTERS, value: "value" };
      yield close("root");
      yield end;
    }
    await expect(x.string("/root").parse(asyncEvents())).resolves.toBe("value");
  });

  it("preserves a ReadableStream chunk error when cancellation also fails", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue("not bytes" as never);
      },
      cancel() {
        throw new Error("cancel failed");
      },
    });

    await expect(x.string().parse(stream)).rejects.toThrow(/Uint8Array/);
  });

  it("rejects unsupported sync and async inputs", async () => {
    expect(() => x.string().parseSync({} as never)).toThrow(
      /cannot be evaluated|unsupported/i,
    );
    expect(() => x.string().parseSync(null as never)).toThrow(
      /cannot be evaluated|unsupported/i,
    );
    expect(() => x.string().parseSync(new ReadableStream() as never)).toThrow(
      /cannot be evaluated|unsupported/i,
    );
    await expect(x.string().parse({} as never)).rejects.toThrow(
      /cannot be evaluated|unsupported/i,
    );
    expect(() =>
      x.string().parseSync([[new Uint8Array(), "bad"]] as never),
    ).toThrow(/only XML event values/i);
  });
});
