import { afterEach, beforeEach, describe, expect, test } from "vitest-pool-assemblyscript/assembly";
import {
  initialize as initializeWasm, reserve, commit, nextBatch, scratch, addEntity,
  dispose,
} from "../tokenizer";

const TOKEN_STRIDE: usize = 80;
const ATTRIBUTE_STRIDE: usize = 48;
let control: usize = 0;
let activeSlot: i32 = 1;
let activeCount: i32 = 0;
let activeIndex: i32 = -1;
let firstBatch: bool = true;
let activeTokenPtr: usize = 0;
let activeAttrPtr: usize = 0;

function reset(mode: i32 = 0, nsAware: i32 = 1, decode: i32 = 1): void {
  control = <usize>initializeWasm(mode, nsAware, decode);
  activeSlot = 1;
  activeCount = 0;
  activeIndex = -1;
  firstBatch = true;
  activeTokenPtr = 0;
  activeAttrPtr = 0;
}

function controlWord(word: i32): i32 {
  return load<i32>(control + <usize>word * 4);
}

function currentRecord(): usize {
  return activeTokenPtr + <usize>activeIndex * TOKEN_STRIDE;
}

function span(pointer: usize, length: i32): string {
  return length < 0 ? "<undefined>" : String.UTF8.decodeUnsafe(pointer, length);
}

function field(id: i32, index: i32 = 0): string {
  const record = currentRecord();
  let pointer: usize = 0;
  let length: i32 = -1;
  if (id >= 0 && id <= 4) {
    pointer = load<usize>(record + <usize>(4 + id * 2) * 4);
    length = load<i32>(record + <usize>(5 + id * 2) * 4);
  } else if (id >= 5 && id <= 9) {
    const count = load<i32>(record + 12);
    if (index < 0 || index >= count) return "<undefined>";
    const attr = activeAttrPtr + <usize>(load<i32>(record + 8) + index) * ATTRIBUTE_STRIDE;
    const word = id == 5 ? 0 : id == 9 ? 2 : id == 6 ? 4 : id == 7 ? 6 : 8;
    pointer = load<usize>(attr + <usize>word * 4);
    length = load<i32>(attr + <usize>(word + 1) * 4);
  } else if (id == 10 || id == 11) {
    const declaration = load<usize>(record + 60);
    if (declaration == 0) return "<undefined>";
    const word = id == 10 ? 0 : 2;
    pointer = load<usize>(declaration + <usize>word * 4);
    length = load<i32>(declaration + <usize>(word + 1) * 4);
  }
  return span(pointer, length);
}

function attributeCount(): i32 { return load<i32>(currentRecord() + 12); }
function selfClosing(): bool { return (load<i32>(currentRecord() + 4) & 1) != 0; }
function declarationStandalone(): i32 {
  const declaration = load<usize>(currentRecord() + 60);
  return declaration == 0 ? -1 : load<i32>(declaration + 16);
}
function namespaceFor(prefix: string): string {
  const bytes = String.UTF8.encode(prefix);
  const bytesPtr = changetype<usize>(bytes);
  let node = <usize>load<i32>(currentRecord() + 56);
  while (node != 0) {
    const length = load<i32>(node + 12);
    if (length == bytes.byteLength) {
      let equal = true;
      for (let i = 0; i < length; i++) if (load<u8>(load<usize>(node + 8) + <usize>i) != load<u8>(bytesPtr + <usize>i)) equal = false;
      if (equal) return String.UTF8.decodeUnsafe(load<usize>(node + 16), load<i32>(node + 20));
    }
    node = load<usize>(node);
  }
  return "";
}
function errorCode(): i32 { return controlWord(11); }
function errorPosition(): i32 { return controlWord(12); }
function errorLen(): i32 { return controlWord(14); }
function inputCapacity(): i32 { return controlWord(15); }

function push(xml: string, final: bool = true): i32 {
  const bytes = String.UTF8.encode(xml);
  const ptr = reserve(bytes.byteLength);
  memory.copy(ptr, changetype<usize>(bytes), bytes.byteLength);
  return commit(bytes.byteLength, final ? 1 : 0);
}

function next(): i32 {
  if (activeIndex + 1 < activeCount) {
    activeIndex++;
    return load<i32>(currentRecord());
  }
  const slot = activeSlot == 0 ? 1 : 0;
  const result = nextBatch(slot, firstBatch ? 1 : 128, 1024, 65536, 262144);
  if (result > 0) {
    activeSlot = slot;
    activeCount = result;
    activeIndex = 0;
    activeTokenPtr = <usize>controlWord(8);
    activeAttrPtr = <usize>controlWord(9);
    firstBatch = false;
    return load<i32>(currentRecord());
  }
  return result;
}

function drain(): string {
  let result = "";
  while (true) {
    const type = next();
    if (type == -1 || type == 0) break;
    expect(type).toBeGreaterThan(0);
    result += type.toString() + ":" + field(0) + ":" + field(1) + ":" + field(4);
    for (let i = 0; i < attributeCount(); i++) result += ":" + field(5, i) + "=" + field(9, i) + "@" + field(8, i);
    result += "\n";
  }
  return result;
}

beforeEach(() => reset());
afterEach(() => dispose());

describe("raw UTF-8 tokenizer behavior", () => {
  test("all token kinds, declaration, and lazy attribute spans", () => {
    expect(push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><!DOCTYPE r><r a="A&amp;B">한😀<![CDATA[x<y]]><!--ok--><?p data?><x/></r>')).toBe(0);
    expect(next()).toBe(1);
    expect(field(10)).toBe("1.0");
    expect(field(11)).toBe("UTF-8");
    expect(declarationStandalone()).toBe(1);
    expect(next()).toBe(9);
    expect(next()).toBe(3);
    expect(field(0)).toBe("r");
    expect(attributeCount()).toBe(1);
    expect(field(5)).toBe("a");
    expect(field(9)).toBe("A&B");
    expect(next()).toBe(5);
    expect(field(1)).toBe("한😀");
    expect(next()).toBe(6);
    expect(field(1)).toBe("x<y");
    expect(next()).toBe(7);
    expect(field(1)).toBe("ok");
    expect(next()).toBe(8);
    expect(field(0)).toBe("p");
    expect(field(1)).toBe("data");
    expect(next()).toBe(3);
    expect(selfClosing()).toBe(true);
    expect(next()).toBe(4);
    expect(field(0)).toBe("x");
    expect(next()).toBe(4);
    expect(field(0)).toBe("r");
    expect(next()).toBe(2);
    expect(next()).toBe(0);
  });

  test("every byte split preserves UTF-8, entities and token boundaries", () => {
    const xml = '\uFEFF<?xml version="1.0"?><r xmlns:p="urn:p" p:a="😀&amp;é">한&#x1F600;<![CDATA[x]]><!--c--><?p x?></r>';
    expect(push(xml)).toBe(0);
    const expected = drain();
    const bytes = String.UTF8.encode(xml);
    for (let cut = 0; cut <= bytes.byteLength; cut++) {
      dispose(); reset(0, 1, 1);
      let ptr = reserve(cut);
      memory.copy(ptr, changetype<usize>(bytes), cut);
      expect(commit(cut, 0)).toBe(0);
      let actual = drain();
      const rest = bytes.byteLength - cut;
      ptr = reserve(rest);
      memory.copy(ptr, changetype<usize>(bytes) + cut, rest);
      expect(commit(rest, 1)).toBe(0);
      actual += drain();
      expect(actual).toBe(expected);
    }
  });

  test("namespace shadowing lasts through the closing element", () => {
    expect(push('<r xmlns:p="outer"><p:x xmlns:p="inner" p:a="1"/><p:y/></r>')).toBe(0);
    expect(next()).toBe(1);
    expect(next()).toBe(3);
    expect(namespaceFor("p")).toBe("outer");
    expect(namespaceFor("xml")).toBe("http://www.w3.org/XML/1998/namespace");
    expect(next()).toBe(3);
    expect(field(4)).toBe("inner");
    expect(field(8, 1)).toBe("inner");
    expect(next()).toBe(4);
    expect(namespaceFor("p")).toBe("inner");
    expect(next()).toBe(3);
    expect(field(4)).toBe("outer");
    expect(namespaceFor("missing")).toBe("");
  });

  test("custom entities expand beyond input size without corrupting adjacent attributes", () => {
    const value = "한😀".repeat(4096);
    const nameBytes = String.UTF8.encode("large");
    const valueBytes = String.UTF8.encode(value);
    const ptr = scratch(nameBytes.byteLength + valueBytes.byteLength);
    memory.copy(ptr, changetype<usize>(nameBytes), nameBytes.byteLength);
    memory.copy(ptr + nameBytes.byteLength, changetype<usize>(valueBytes), valueBytes.byteLength);
    expect(addEntity(ptr, nameBytes.byteLength, ptr + nameBytes.byteLength, valueBytes.byteLength)).toBe(0);
    expect(push('<r first="stable&amp;" expanded="&large;" last="tail">&large;</r>')).toBe(0);
    expect(next()).toBe(1);
    expect(next()).toBe(3);
    expect(field(9, 0)).toBe("stable&");
    expect(field(9, 1)).toBe(value);
    expect(field(9, 2)).toBe("tail");
    expect(next()).toBe(5);
    expect(field(1)).toBe(value);
  });

  test("raw entity mode and namespace-unaware names stay intact", () => {
    dispose(); reset(0, 0, 0);
    expect(push('<a:b q:r="&amp;&#65;">&lt;&#x41;</a:b>')).toBe(0);
    expect(next()).toBe(1);
    expect(next()).toBe(3);
    expect(field(0)).toBe("a:b");
    expect(field(9)).toBe("&amp;&#65;");
    expect(field(4)).toBe("");
    expect(next()).toBe(5);
    expect(field(1)).toBe("&lt;&#x41;");
  });

  test("lane boundaries preserve entities, UTF-8 and invalid controls", () => {
    for (let offset = 0; offset < 32; offset++) {
      const prefix = "x".repeat(offset);
      const suffix = "y".repeat(32 - offset);
      dispose(); reset(0, 1, 1);
      expect(push("<r>" + prefix + "&amp;😀" + suffix + "</r>")).toBe(0);
      expect(next()).toBe(1);
      expect(next()).toBe(3);
      expect(next()).toBe(5);
      expect(field(1)).toBe(prefix + "&😀" + suffix);

      dispose(); reset(0, 1, 1);
      expect(push("<r>" + prefix + "\u0000" + suffix + "</r>")).toBe(0);
      expect(next()).toBe(1);
      expect(next()).toBe(3);
      expect(next()).toBe(-2);
    }
  });

  test("malformed XML and UTF-8 return errors rather than successful EOF", () => {
    const invalid = ["<r>", "<r></x>", '<r a="1" a="2"/>', "<p:r/>", "<r>&missing;</r>", "<r>&#0;</r>", "<!--a--b-->", "<!--a--->", "<r><![CDATA[x</r>"];
    for (let i = 0; i < invalid.length; i++) {
      dispose(); reset(0, 1, 1);
      const committed = push(invalid[i]);
      let type = committed;
      if (committed == 0) {
        do { type = next(); } while (type > 0);
      }
      expect(type).toBe(-2);
      expect(errorCode()).toBeGreaterThan(0);
      expect(errorLen()).toBeGreaterThan(0);
      expect(errorPosition()).toBeGreaterThanOrEqual(0);
    }
    dispose(); reset(0, 1, 1);
    const ptr = reserve(3);
    store<u8>(ptr, 0xed); store<u8>(ptr + 1, 0xa0); store<u8>(ptr + 2, 0x80);
    expect(commit(3, 1)).toBe(-2);
    expect(errorCode()).toBeGreaterThan(0);
  });

  test("document mode rejects a second root while fragments accept it", () => {
    expect(push("<a/><b/>")).toBe(0);
    expect(drain()).toContain("3:b:");
    dispose(); reset(1, 1, 1);
    expect(push("<a/><b/>")).toBe(0);
    let type: i32;
    do { type = next(); } while (type > 0);
    expect(type).toBe(-2);
  });

  test("reused input and namespace scratch do not grow with stream length", () => {
    expect(push('<r xmlns:p="urn:p">', false)).toBe(0);
    drain();
    expect(push("x".repeat(131072) + "<p:x/>", false)).toBe(0);
    drain();
    expect(namespaceFor("p")).toBe("urn:p");
    const capacity = inputCapacity();
    for (let i = 0; i < 1024; i++) {
      expect(push("<p:x/>", false)).toBe(0);
      drain();
      expect(namespaceFor("p")).toBe("urn:p");
    }
    expect(inputCapacity()).toBe(capacity);
    // Runtime-managed test strings may grow memory; raw namespace scratch must
    // independently reuse a warmed allocation, without any test allocations.
    const ptr = scratch(256);
    const scratchPages = memory.size();
    let reused = true;
    for (let i = 0; i < 100000; i++) {
      if (scratch(256) != ptr) reused = false;
    }
    const afterScratchPages = memory.size();
    expect(reused).toBe(true);
    expect(afterScratchPages).toBe(scratchPages);
    expect(push("</r>")).toBe(0);
    expect(drain()).toContain("4:r:");
  });
});
