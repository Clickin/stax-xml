import { readCodePoint, width, nameStart, namePart } from "./utf8";

export function markerPrefix(start: usize, length: i32, marker: string): bool {
  if (length > marker.length) return false;
  for (let i = 0; i < length; i++) if (load<u8>(start + i) != <u8>marker.charCodeAt(i)) return false;
  return true;
}

export function findSequence(start: usize, end: usize, a: u8, b: u8, c: u8 = 0, sequenceWidth: i32 = 2): i32 {
  let at = start;
  if (sequenceWidth == 3) {
    while (ASC_FEATURE_SIMD && at + 16 <= end) {
      const block = v128.load(at);
      const mask = i8x16.bitmask(i8x16.eq(block, i8x16.splat(a)));
      if (mask != 0) {
        let bit = ctz<i32>(mask);
        while (bit < 16) {
          const candidate = at + <usize>bit;
          if (candidate + 2 < end && load<u8>(candidate + 1) == b && load<u8>(candidate + 2) == c) return <i32>candidate;
          const rest = mask & (-1 << (bit + 1));
          if (rest == 0) break;
          bit = ctz<i32>(rest);
        }
      }
      at += 16;
    }
    while (at + 2 < end) {
      if (load<u8>(at) == a && load<u8>(at + 1) == b && load<u8>(at + 2) == c) return <i32>at;
      at++;
    }
  } else {
    while (ASC_FEATURE_SIMD && at + 16 <= end) {
      const block = v128.load(at);
      const mask = i8x16.bitmask(i8x16.eq(block, i8x16.splat(a)));
      if (mask != 0) {
        let bit = ctz<i32>(mask);
        while (bit < 16) {
          const candidate = at + <usize>bit;
          if (candidate + 1 < end && load<u8>(candidate + 1) == b) return <i32>candidate;
          const rest = mask & (-1 << (bit + 1));
          if (rest == 0) break;
          bit = ctz<i32>(rest);
        }
      }
      at += 16;
    }
    while (at + 1 < end) {
      if (load<u8>(at) == a && load<u8>(at + 1) == b) return <i32>at;
      at++;
    }
  }
  return -1;
}

// -1 means unresolved without a quote; otherwise -2 - quote preserves it.
export function findTagEnd(start: usize, end: usize, from: usize, quote: i32): i32 {
  let at = from < start ? start : from;
  let q = quote;
  while (at < end) {
    const b = <i32>load<u8>(at);
    if (q != 0) {
      if (b == q) q = 0;
    } else if (b == 34 || b == 39) q = b;
    else if (b == 62) return <i32>at;
    at++;
  }
  return q == 0 ? -1 : -2 - q;
}

export function scanName(start: usize, end: usize): i32 {
  let at = start;
  const first = readCodePoint(at, end);
  if (first < 0 || !nameStart(first)) return -1;
  at += <usize>width(at, end);
  while (at < end) {
    const next = readCodePoint(at, end);
    if (next < 0 || (!nameStart(next) && !namePart(next))) break;
    at += <usize>width(at, end);
  }
  return <i32>at;
}

export function qnameColon(start: usize, end: usize): i32 {
  let colon = -1;
  let count = 0;
  for (let at = start; at < end; at++) if (load<u8>(at) == 58) { colon = <i32>at; count++; }
  if (count > 1 || colon == <i32>start || colon == <i32>end - 1) return -2;
  return colon;
}
