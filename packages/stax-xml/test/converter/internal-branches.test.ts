import { describe, expect, it } from "vitest";
import { XmlSchemaBase } from "../../src/converter/converter/base.js";
import { x } from "../../src/converter/converter/index.js";
import { XmlParseError } from "../../src/converter/converter/errors.js";
import {
  ownWriteOptions,
  rootWriteOptions,
} from "../../src/converter/converter/write-utils.js";

describe("converter internal branches", () => {
  it("reports missing parser initialization hooks", async () => {
    const asyncParser = XmlSchemaBase._tryParseAsyncWithCompiledPlan;
    const syncParser = XmlSchemaBase._tryParseWithCompiledPlan;
    const precompile = XmlSchemaBase._precompileWithCompiledPlan;
    try {
      XmlSchemaBase._tryParseAsyncWithCompiledPlan = undefined;
      await expect(x.string().parse("<value/>")).rejects.toThrow(
        /not initialized/,
      );
      XmlSchemaBase._tryParseWithCompiledPlan = undefined;
      expect(() => x.string().parseSync("<value/>")).toThrow(/not initialized/);
      XmlSchemaBase._precompileWithCompiledPlan = undefined;
      expect(() => x.string().precompile()).toThrow(/not initialized/);
    } finally {
      XmlSchemaBase._tryParseAsyncWithCompiledPlan = asyncParser;
      XmlSchemaBase._tryParseWithCompiledPlan = syncParser;
      XmlSchemaBase._precompileWithCompiledPlan = precompile;
    }
  });

  it("normalizes Error and non-Error failures in safe parse methods", async () => {
    const asyncError = x.string();
    asyncError.parse = async () => {
      throw new Error("async failure");
    };
    await expect(asyncError.safeParse("<value/>")).resolves.toMatchObject({
      success: false,
      error: { issues: [{ message: "async failure" }] },
    });

    const asyncValue = x.string();
    asyncValue.parse = async () => {
      throw "async value";
    };
    await expect(asyncValue.safeParse("<value/>")).resolves.toMatchObject({
      success: false,
      error: { issues: [{ message: "async value" }] },
    });

    const syncError = x.string();
    syncError.parseSync = () => {
      throw new Error("sync failure");
    };
    expect(syncError.safeParseSync("<value/>")).toMatchObject({
      success: false,
      error: { issues: [{ message: "sync failure" }] },
    });

    const syncValue = x.string();
    syncValue.parseSync = () => {
      throw 7;
    };
    expect(syncValue.safeParseSync("<value/>")).toMatchObject({
      success: false,
      error: { issues: [{ message: "7" }] },
    });

    const parsed = new XmlParseError([
      { path: ["value"], message: "parsed", code: "custom" },
    ]);
    const asyncParsed = x.string();
    asyncParsed.parse = async () => {
      throw parsed;
    };
    expect((await asyncParsed.safeParse("<value/>")).error).toBe(parsed);
    const syncParsed = x.string();
    syncParsed.parseSync = () => {
      throw parsed;
    };
    expect(syncParsed.safeParseSync("<value/>").error).toBe(parsed);
  });

  it("preserves existing and absent internal writer configurations", () => {
    const config = { element: "value" };
    const rooted = rootWriteOptions(undefined, config)!;

    expect(rootWriteOptions(rooted, config)).toBe(rooted);
    expect(ownWriteOptions(rooted)).toBe(rooted);
  });

  it("rejects schema combinations that the streaming dispatch cannot represent", () => {
    const cases = [
      x.object({ value: x.string("./value") }).xpath("/root/@id"),
      x.object({ value: x.string("./value") }).xpath("./root"),
      x.array(x.object({ value: x.string("./value") }), "/root/@id"),
      x.array(x.string("/root/item"), "/root/item"),
      x.array(x.array(x.string(), "./value"), "/root/item"),
      x.array(x.string()),
      x.object({ value: x.string() }).xpath("/root"),
      x.object({ values: x.array(x.string()) }).xpath("/root"),
      x
        .object({ values: x.array(x.array(x.string(), "./value"), "./group") })
        .xpath("/root"),
    ];

    for (const schema of cases) {
      expect(() => schema.precompile()).toThrow(
        /unsupported streaming XPath|requires xpath/i,
      );
    }
  });
});
