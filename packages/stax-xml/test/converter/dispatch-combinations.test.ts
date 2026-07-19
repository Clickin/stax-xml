import { describe, expect, it } from "vitest";
import { x } from "../../src/converter/converter/index.js";

describe("compiled converter dispatch combinations", () => {
  it("combines positional, relative, attribute, nested, and transformed captures", () => {
    const schema = x.object({
      secondId: x.string("/root/item[2]/@id"),
      secondText: x.string("/root/item[2]/text()"),
      items: x.array(
        x.object({
          id: x.string("./@id"),
          kind: x.string("./@kind"),
          name: x.string("./name"),
          tags: x.array(x.string(), "./tag"),
        }),
        "/root/item",
      ),
      total: x
        .array(x.number(), "/root/item/value")
        .transform((values) => values.reduce((sum, value) => sum + value, 0)),
    });
    const xml =
      '<root><item id="a" kind="x"><name>A</name><tag>one</tag><tag>two</tag><value>2</value></item><item id="b" kind="y">B<value>3</value></item></root>';

    expect(schema.parseSync(xml)).toEqual({
      secondId: "b",
      secondText: "B",
      items: [
        { id: "a", kind: "x", name: "A", tags: ["one", "two"] },
        { id: "b", kind: "y", name: "", tags: [] },
      ],
      total: 5,
    });
    expect(
      x
        .array(x.string(), "//item/@id")
        .parseSync('<root><item/><item id="7"/></root>'),
    ).toEqual(["7"]);
    expect(
      x
        .string("//item")
        .parseSync("<root><item>first</item><item>second</item></root>"),
    ).toBe("first");
  });

  it("keeps overlapping captures and rejects same-name selector near misses", () => {
    const schema = x.object({
      whole: x.string("/root/item"),
      direct: x.string("/root/item/text()"),
      name: x.string("/root/item/name"),
      selected: x.array(x.string(), "/root/group/value"),
      descendants: x.array(x.string(), "//target/value"),
    });

    expect(
      schema.parseSync(
        "<root><other><value>wrong</value></other><item> a <name>N</name> b </item>" +
          "<group><value>right</value></group><noise><value>wrong</value></noise>" +
          "<target><value>descendant</value></target></root>",
        { trimText: false },
      ),
    ).toEqual({
      whole: " a N b ",
      direct: " a  b ",
      name: "N",
      selected: ["right"],
      descendants: ["descendant"],
    });
  });

  it("tracks fields beyond the bitset range and supplies missing defaults", () => {
    const shape: Record<string, ReturnType<typeof x.string>> = {};
    for (let index = 0; index < 35; index++) {
      shape[`field${index}`] = x.string(`/root/field${index}`);
    }
    const schema = x.object(shape);

    const result = schema.parseSync("<root><field34>last</field34></root>");

    expect(result.field0).toBe("");
    expect(result.field30).toBe("");
    expect(result.field31).toBe("");
    expect(result.field34).toBe("last");
    expect(x.object({}).parseSync("<root/>")).toEqual({});
  });

  it("applies each missing-value policy before transforms", () => {
    const schema = x.object({
      text: x.string("/root/missing"),
      number: x.number("/root/missing"),
      optionalText: x.string("/root/missing").optional(),
      optionalNumber: x.number("/root/missing").optional(),
      list: x.array(x.string(), "/root/missing"),
      optionalObject: x
        .object({ value: x.string("./value") })
        .xpath("/root/missing")
        .optional(),
      transformed: x
        .string("/root/missing")
        .transform((value) => value || "fallback"),
    });

    const result = schema.parseSync("<root/>");

    expect(result).toMatchObject({
      text: "",
      optionalText: undefined,
      optionalNumber: undefined,
      list: [],
      optionalObject: undefined,
      transformed: "fallback",
    });
    expect(Number.isNaN(result.number)).toBe(true);
    expect(Number.isNaN(x.number("/root/missing").parseSync("<root/>"))).toBe(
      true,
    );
    expect(
      x
        .object({ value: x.string("./value") })
        .xpath("/root/missing")
        .parseSync("<root/>"),
    ).toEqual({});
    expect(
      x
        .array(x.string().optional(), "/root/item")
        .parseSync("<root><item/></root>"),
    ).toEqual([""]);
    expect(
      x
        .array(x.number().optional(), "/root/item")
        .parseSync("<root><item/></root>"),
    ).toEqual([undefined]);
  });

  it("dispatches byte and synchronous iterable inputs through async parsing", async () => {
    const schema = x.string("/root/value");
    const bytes = new TextEncoder().encode("<root><value>bytes</value></root>");

    expect(schema.parseSync(bytes)).toBe("bytes");
    await expect(schema.parse(bytes)).resolves.toBe("bytes");
    await expect(
      schema.parse([bytes.subarray(0, 8), bytes.subarray(8)]),
    ).resolves.toBe("bytes");
    expect(schema.parseSync(bytes, x.string() as never)).toBe("bytes");
    expect(schema.parseSync(bytes, null as never)).toBe("bytes");
  });

  it("enforces maximum depth independently of the event limit", () => {
    const schema = x.string("/root/value");

    expect(() =>
      schema.parseSync("<root><nested><value>x</value></nested></root>", {
        maxDepth: 2,
      }),
    ).toThrow(/depth/i);
  });

  it("uses interpreter fallbacks when dynamic function construction is blocked", () => {
    const NativeFunction = globalThis.Function;
    let attempts = 0;
    globalThis.Function = function blockedFunction(): never {
      attempts++;
      throw new EvalError("dynamic code disabled");
    } as unknown as FunctionConstructor;
    try {
      const schema = x.object({
        id: x.string("/root/item/@id"),
        value: x.string("/root/item"),
      });
      expect(
        schema.parseSync('<root><item id="7">value</item></root>'),
      ).toEqual({ id: "7", value: "value" });
      expect(
        x.string("/root/item").parseSync("<root><item>scalar</item></root>"),
      ).toBe("scalar");
      expect(
        x
          .string("/root/item/@id")
          .parseSync(
            '<root>ignored<![CDATA[ignored]]><item id="attribute"/></root>',
          ),
      ).toBe("attribute");
      expect(
        x
          .object({
            whole: x.string("/root/item"),
            direct: x.string("/root/item/text()"),
            name: x.string("/root/item/name"),
            values: x.array(x.string(), "/root/group/value"),
          })
          .parseSync(
            "<root><other><value>skip</value></other><item>a<name>N</name>b</item>" +
              "<group><value>keep</value></group></root>",
          ),
      ).toEqual({ whole: "aNb", direct: "ab", name: "N", values: ["keep"] });
      expect(
        x
          .string("/root/item")
          .parseSync("<root><item> x </item></root>", { trimText: false }),
      ).toBe(" x ");
      expect(
        x
          .array(
            x.object({
              detail: x
                .object({ value: x.string("./value") })
                .xpath("//detail"),
            }),
            "//item",
          )
          .parseSync(
            "<root><item><item><item><item><detail><value>X</value></detail></item></item></item></item></root>",
          ),
      ).toEqual([
        { detail: { value: "X" } },
        { detail: { value: "X" } },
        { detail: { value: "X" } },
        { detail: { value: "X" } },
      ]);

      const nested = x.object({
        groups: x.array(
          x.object({
            id: x.string("./@id"),
            second: x.string("./item[2]"),
            items: x
              .array(x.string(), "./item")
              .transform((items) => items.join(",")),
            detail: x.object({ value: x.string("./value") }).xpath("./detail"),
          }),
          "/root/group",
        ),
      });
      expect(
        nested.parseSync(
          '<root><item>outside</item><group id="g"><item>a</item><item>b</item><item>ignored</item><detail><value>v</value></detail></group></root>',
        ),
      ).toEqual({
        groups: [
          {
            id: "g",
            second: "b",
            items: "a,b,ignored",
            detail: { value: "v" },
          },
        ],
      });
      expect(
        x
          .object({ value: x.string("./value") })
          .xpath("/root/item")
          .parseSync(
            "<root><noise/><item><value>selected</value></item></root>",
          ),
      ).toEqual({ value: "selected" });
      expect(attempts).toBeGreaterThan(0);
    } finally {
      globalThis.Function = NativeFunction;
    }
  });
});
