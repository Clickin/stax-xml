let need: i32 = 0;
let code: i32 = 0;
let minimum: i32 = 0;

export function reset(): void {
  need = 0;
  code = 0;
  minimum = 0;
}

export function appendValid(start: usize, length: usize, final: bool): bool {
  for (let i: usize = 0; i < length; i++) {
    if (ASC_FEATURE_SIMD && need == 0 && i + 16 <= length) {
      const nonAscii = i8x16.bitmask(v128.load(start + i));
      const asciiLength = nonAscii == 0 ? 16 : ctz<i32>(nonAscii);
      if (asciiLength != 0) {
        i += <usize>asciiLength - 1;
        continue;
      }
    }
    const b = <i32>load<u8>(start + i);
    if (need == 0) {
      if (b < 0x80) continue;
      if (b >= 0xc2 && b <= 0xdf) { need = 1; code = b & 31; minimum = 0x80; continue; }
      if (b >= 0xe0 && b <= 0xef) { need = 2; code = b & 15; minimum = 0x800; continue; }
      if (b >= 0xf0 && b <= 0xf4) { need = 3; code = b & 7; minimum = 0x10000; continue; }
      return false;
    }
    if (b < 0x80 || b > 0xbf) return false;
    code = (code << 6) | (b & 63);
    need--;
    if (need == 0 && (code < minimum || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff))) return false;
  }
  return !final || need == 0;
}

export function readCodePoint(p: usize, end: usize): i32 {
  if (p >= end) return -1;
  const a = <i32>load<u8>(p);
  if (a < 0x80) return a;
  if (a >= 0xc2 && a <= 0xdf && p + 1 < end) {
    const b = <i32>load<u8>(p + 1);
    if (b < 0x80 || b > 0xbf) return -1;
    return ((a & 0x1f) << 6) | (b & 0x3f);
  }
  if (a >= 0xe0 && a <= 0xef && p + 2 < end) {
    const b = <i32>load<u8>(p + 1); const c = <i32>load<u8>(p + 2);
    if (b < 0x80 || b > 0xbf || c < 0x80 || c > 0xbf) return -1;
    const cp = ((a & 0x0f) << 12) | ((b & 0x3f) << 6) | (c & 0x3f);
    return cp < 0x800 || (cp >= 0xd800 && cp <= 0xdfff) ? -1 : cp;
  }
  if (a >= 0xf0 && a <= 0xf4 && p + 3 < end) {
    const b = <i32>load<u8>(p + 1); const c = <i32>load<u8>(p + 2); const d = <i32>load<u8>(p + 3);
    if (b < 0x80 || b > 0xbf || c < 0x80 || c > 0xbf || d < 0x80 || d > 0xbf) return -1;
    const cp = ((a & 7) << 18) | ((b & 0x3f) << 12) | ((c & 0x3f) << 6) | (d & 0x3f);
    return cp < 0x10000 || cp > 0x10ffff ? -1 : cp;
  }
  return -1;
}

export function width(p: usize, end: usize): i32 {
  if (p >= end) return 0;
  const a = load<u8>(p);
  if (a < 0x80) return 1;
  if (a >= 0xc2 && a <= 0xdf && p + 1 < end) return 2;
  if (a >= 0xe0 && a <= 0xef && p + 2 < end) return 3;
  if (a >= 0xf0 && a <= 0xf4 && p + 3 < end) return 4;
  return 1;
}

export function xmlChar(cp: i32): bool {
  return cp == 9 || cp == 10 || cp == 13 || (cp >= 0x20 && cp <= 0xd7ff) || (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff);
}
export function asciiLetter(cp: i32): bool { return (cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122); }
export function nameStart(cp: i32): bool {
  return cp == 58 || cp == 95 || asciiLetter(cp) || (cp >= 0xc0 && cp <= 0xd6) || (cp >= 0xd8 && cp <= 0xf6) || (cp >= 0xf8 && cp <= 0x2ff) || (cp >= 0x370 && cp <= 0x37d) || (cp >= 0x37f && cp <= 0x1fff) || (cp >= 0x200c && cp <= 0x200d) || (cp >= 0x2070 && cp <= 0x218f) || (cp >= 0x2c00 && cp <= 0x2fef) || (cp >= 0x3001 && cp <= 0xd7ff) || (cp >= 0xf900 && cp <= 0xfdcf) || (cp >= 0xfdf0 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0xeffff);
}
export function namePart(cp: i32): bool { return (cp >= 48 && cp <= 57) || cp == 45 || cp == 46 || cp == 0xb7 || (cp >= 0x300 && cp <= 0x36f) || (cp >= 0x203f && cp <= 0x2040); }
