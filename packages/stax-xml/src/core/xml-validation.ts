export function assertXmlName(value: string, label: string): void {
  let index = 0;
  while (index < value.length) {
    const code = value.codePointAt(index)!;
    const start = index === 0;
    if (!isNameStart(code) && !( !start && isNamePart(code))) {
      throw new Error(`Invalid XML ${label}: ${value}`);
    }
    index += code > 0xffff ? 2 : 1;
  }
  if (index === 0) throw new Error(`Invalid XML ${label}: ${value}`);
}

export function assertXmlChars(value: string, label: string): void {
  for (let index = 0; index < value.length; index++) {
    const code = value.codePointAt(index)!;
    if ((code < 0x20 && code !== 9 && code !== 10 && code !== 13)
      || (code >= 0xd800 && code <= 0xdfff) || (code > 0xfffd && code < 0x10000)) {
      throw new Error(`Invalid XML character in ${label}.`);
    }
    if (code > 0xffff) index++;
  }
}

function isNameStart(code: number): boolean {
  return code === 58 || code === 95 || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
    || (code >= 0xc0 && code <= 0xd6) || (code >= 0xd8 && code <= 0xf6)
    || (code >= 0xf8 && code <= 0x2ff) || (code >= 0x370 && code <= 0x37d)
    || (code >= 0x37f && code <= 0x1fff) || (code >= 0x200c && code <= 0x200d)
    || (code >= 0x2070 && code <= 0x218f) || (code >= 0x2c00 && code <= 0x2fef)
    || (code >= 0x3001 && code <= 0xd7ff) || (code >= 0xf900 && code <= 0xfdcf)
    || (code >= 0xfdf0 && code <= 0xfffd) || (code >= 0x10000 && code <= 0xeffff);
}

function isNamePart(code: number): boolean {
  return (code >= 48 && code <= 57) || code === 45 || code === 46 || code === 0xb7
    || (code >= 0x300 && code <= 0x36f) || (code >= 0x203f && code <= 0x2040);
}
