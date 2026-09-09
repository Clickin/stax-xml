import { appendValid, reset as resetUtf8, width as utf8Width, readCodePoint as utf8ReadCodePoint, xmlChar as utf8XmlChar, asciiLetter as utf8AsciiLetter, nameStart as utf8NameStart, namePart as utf8NamePart } from "./utf8";
import { markerPrefix as scanMarkerPrefix, findSequence as scanFindSequence, findTagEnd as scanFindTagEnd, scanName as scanScanName, qnameColon as scanQnameColon } from "./scan";

// Raw UTF-8 tokenizer. The JavaScript facade owns all string/event materialization.
// Pointers are byte offsets in linear memory; lengths are UTF-8 byte lengths.

const NO: i32 = -3;
const NEED: i32 = -1;
const ERROR: i32 = -2;
const EOF: i32 = 0;
const START_DOCUMENT: i32 = 1;
const END_DOCUMENT: i32 = 2;
const START_ELEMENT: i32 = 3;
const END_ELEMENT: i32 = 4;
const CHARACTERS: i32 = 5;
const CDATA: i32 = 6;
const COMMENT: i32 = 7;
const PI: i32 = 8;
const DTD: i32 = 9;

// Stable error categories consumed by the facade. Messages remain available in errorPtr/errorLen.
const ERROR_PARSE: i32 = 1;
const ERROR_UTF8: i32 = 2;
const ERROR_STATE: i32 = 3;

const RESUME_NONE: i32 = 0;
const RESUME_TEXT: i32 = 1;
const RESUME_START: i32 = 2;
const RESUME_END: i32 = 3;
const RESUME_COMMENT: i32 = 4;
const RESUME_CDATA: i32 = 5;
const RESUME_PI: i32 = 6;
const RESUME_DOCTYPE: i32 = 7;

const XML_URI = "http://www.w3.org/XML/1998/namespace";
const XMLNS_URI = "http://www.w3.org/2000/xmlns/";
const XMLNS = "xmlns";
const XML_TARGET = "<?xml";
const HASH_OFFSET: u32 = 2166136261;

let disposed: bool = false;
let initialized: bool = false;
let documentMode: i32 = 0;
let namespaceAware: bool = true;
let autoDecode: bool = true;
let isFinal: bool = false;
let inputPtr: usize = 0;
let inputCap: usize = 0;
let inputLen: usize = 0;
let inputPos: usize = 0;
let inputBase: i32 = 0;
let reserved: usize = 0;
let started: bool = false;
let ended: bool = false;
let leadingPending: bool = true;
let leadingBomCount: i32 = 0;
let roots: i32 = 0;
let declarationAllowed: bool = true;
let seenDoctype: bool = false;
let doctypeRootPtr: usize = 0;
let doctypeRootLen: i32 = -1;
let currentType: i32 = START_DOCUMENT;
let currentEvent: i32 = 0;
let currentSelfClosing: bool = false;
let currentAttrCount: i32 = 0;
let pendingEnd: bool = false;
let pendingNamePtr: usize = 0;
let pendingNameLen: i32 = 0;
let pendingLocalPtr: usize = 0;
let pendingLocalLen: i32 = 0;
let pendingPrefixPtr: usize = 0;
let pendingPrefixLen: i32 = 0;
let pendingUriPtr: usize = 0;
let pendingUriLen: i32 = 0;
let pendingUndo: i32 = -1;
let pendingState: usize = 0;
let resumeKind: i32 = RESUME_NONE;
let resumeOffset: usize = 0;
let resumeQuote: i32 = 0;
let resumeBrackets: i32 = 0;
let resumeComment: bool = false;
let errorKind: i32 = 0;
let errorAt: i32 = -1;
let errorMessagePtr: usize = 0;
let errorMessageLen: i32 = 0;
let lastWidth: i32 = 0;
let decodeResultLen: i32 = 0;
let decodeHadEntity: bool = false;
let parseNameError: bool = false;
let tokenHeader: usize = 0;

// Current fields: 0 name, 1 text, 2 local, 3 prefix, 4 URI,
// 10 declaration version, 11 declaration encoding, 12 namespace lookup.
let fieldPtrs: usize = 0;
let fieldLens: usize = 0;
let declarationStandaloneValue: i32 = -1;
let xmlUriPtr: usize = 0;
let xmlnsUriPtr: usize = 0;
let declarationVersionPtr: usize = 0;
let declarationEncodingPtr: usize = 0;
let declarationEncodingLen: i32 = -1;
let declarationStandaloneStored: i32 = -1;

// Reusable raw token output and retained state arenas.
let tokenPtr: usize = 0;
let tokenCap: usize = 0;
let tokenUsed: usize = 0;
let statePtr: usize = 0;
let stateCap: usize = 0;
let stateUsed: usize = 0;
let stateFloor: usize = 0;
let scratchPtr: usize = 0;
let scratchCap: usize = 0;

// Element frames: name, local, prefix, URI, namespace undo count, arena mark.
let stackCap: i32 = 0;
let stackDepth: i32 = 0;
let stackName: usize = 0;
let stackNameLen: usize = 0;
let stackLocal: usize = 0;
let stackLocalLen: usize = 0;
let stackPrefix: usize = 0;
let stackPrefixLen: usize = 0;
let stackUri: usize = 0;
let stackUriLen: usize = 0;
let stackUndo: usize = 0;
let stackMark: usize = 0;

// Namespace bindings are searched backwards; popping to a frame's undo count restores scope.
let nsCap: i32 = 0;
let nsCount: i32 = 0;
let nsPrefix: usize = 0;
let nsPrefixLen: usize = 0;
let nsUri: usize = 0;
let nsUriLen: usize = 0;

// Attribute records use input name spans and token/input value spans.
let attrCap: i32 = 0;
let attrName: usize = 0;
let attrNameLen: usize = 0;
let attrValue: usize = 0;
let attrValueLen: usize = 0;
let attrColon: usize = 0;
let attrUri: usize = 0;
let attrUriLen: usize = 0;

// Custom entity definitions are retained separately from the poppable element arena.
let entityCap: i32 = 0;
let entityCount: i32 = 0;
let entityName: usize = 0;
let entityNameLen: usize = 0;
let entityValue: usize = 0;
let entityValueLen: usize = 0;

function allocRaw(size: usize): usize {
  if (size == 0) return 0;
  return heap.alloc(size);
}

function releaseOwned(): void {
  if (inputPtr != 0) heap.free(inputPtr);
  if (tokenPtr != 0) heap.free(tokenPtr);
  if (statePtr != 0) heap.free(statePtr);
  if (scratchPtr != 0) heap.free(scratchPtr);
  if (errorMessagePtr != 0) heap.free(errorMessagePtr);
  if (tokenHeader != 0) heap.free(tokenHeader);
  if (fieldPtrs != 0) heap.free(fieldPtrs);
  if (fieldLens != 0) heap.free(fieldLens);
  if (stackName != 0) heap.free(stackName);
  if (stackNameLen != 0) heap.free(stackNameLen);
  if (stackLocal != 0) heap.free(stackLocal);
  if (stackLocalLen != 0) heap.free(stackLocalLen);
  if (stackPrefix != 0) heap.free(stackPrefix);
  if (stackPrefixLen != 0) heap.free(stackPrefixLen);
  if (stackUri != 0) heap.free(stackUri);
  if (stackUriLen != 0) heap.free(stackUriLen);
  if (stackUndo != 0) heap.free(stackUndo);
  if (stackMark != 0) heap.free(stackMark);
  if (nsPrefix != 0) heap.free(nsPrefix);
  if (nsPrefixLen != 0) heap.free(nsPrefixLen);
  if (nsUri != 0) heap.free(nsUri);
  if (nsUriLen != 0) heap.free(nsUriLen);
  if (attrName != 0) heap.free(attrName);
  if (attrNameLen != 0) heap.free(attrNameLen);
  if (attrValue != 0) heap.free(attrValue);
  if (attrValueLen != 0) heap.free(attrValueLen);
  if (attrColon != 0) heap.free(attrColon);
  if (attrUri != 0) heap.free(attrUri);
  if (attrUriLen != 0) heap.free(attrUriLen);
  if (entityName != 0) heap.free(entityName);
  if (entityNameLen != 0) heap.free(entityNameLen);
  if (entityValue != 0) heap.free(entityValue);
  if (entityValueLen != 0) heap.free(entityValueLen);
  inputPtr = 0; tokenPtr = 0; statePtr = 0; scratchPtr = 0; errorMessagePtr = 0; tokenHeader = 0;
  fieldPtrs = 0; fieldLens = 0;
  stackName = 0; stackNameLen = 0; stackLocal = 0; stackLocalLen = 0;
  stackPrefix = 0; stackPrefixLen = 0; stackUri = 0; stackUriLen = 0;
  stackUndo = 0; stackMark = 0;
  nsPrefix = 0; nsPrefixLen = 0; nsUri = 0; nsUriLen = 0;
  attrName = 0; attrNameLen = 0; attrValue = 0; attrValueLen = 0;
  attrColon = 0; attrUri = 0; attrUriLen = 0;
  entityName = 0; entityNameLen = 0; entityValue = 0; entityValueLen = 0;
}

function copyBytes(dst: usize, src: usize, length: usize): void {
  if (length != 0) memory.copy(dst, src, length);
}

function rawPointer(base: usize, index: i32): usize {
  return load<usize>(base + <usize>index * 4);
}

function setRawPointer(base: usize, index: i32, value: usize): void {
  store<usize>(base + <usize>index * 4, value);
}

function rawInt(base: usize, index: i32): i32 {
  return load<i32>(base + <usize>index * 4);
}

function setRawInt(base: usize, index: i32, value: i32): void {
  store<i32>(base + <usize>index * 4, value);
}

function zeroFields(): void {
  for (let i = 0; i < 13; i++) {
    setRawPointer(fieldPtrs, i, 0);
    setRawInt(fieldLens, i, -1);
  }
  setRawInt(fieldLens, 3, 0);
  setRawInt(fieldLens, 4, 0);
  setRawInt(fieldLens, 12, 0);
  setRawPointer(fieldPtrs, 10, declarationVersionPtr);
  setRawInt(fieldLens, 10, declarationVersionPtr == 0 ? -1 : 3);
  setRawPointer(fieldPtrs, 11, declarationEncodingPtr);
  setRawInt(fieldLens, 11, declarationEncodingLen);
  declarationStandaloneValue = declarationStandaloneStored;
}

function setError(kind: i32, position: i32, message: string): i32 {
  if (errorKind != 0) return ERROR;
  errorKind = kind;
  errorAt = position;
  const n: usize = message.length;
  const p: usize = allocRaw(n);
  if (p != 0) {
    for (let i: usize = 0; i < n; i++) store<u8>(p + i, <u8>message.charCodeAt(<i32>i));
    errorMessagePtr = p;
    errorMessageLen = <i32>n;
  }
  return ERROR;
}

function fail(message: string, position: i32 = -1): i32 {
  let at = position;
  if (at < 0) at = inputBase + <i32>inputPos;
  return setError(ERROR_PARSE, at, message);
}

function failUtf8(position: i32): i32 {
  return setError(ERROR_UTF8, inputBase + position, "Invalid UTF-8 sequence.");
}

function ensureToken(required: usize): bool {
  if (required <= tokenCap) return true;
  let next: usize = tokenCap == 0 ? 256 : tokenCap;
  while (next < required) {
    if (next > 0x3fffffff) return false;
    next *= 2;
  }
  const p = allocRaw(next);
  if (p == 0) return false;
  const oldPtr = tokenPtr;
  const oldCap = tokenCap;
  if (oldPtr != 0 && tokenUsed != 0) copyBytes(p, oldPtr, tokenUsed);
  if (oldPtr != 0) {
    for (let i = 0; i < currentAttrCount; i++) setRawPointer(attrValue, i, relocateTokenPointer(rawPointer(attrValue, i), oldPtr, oldCap, p));
    for (let i = 0; i < 13; i++) setRawPointer(fieldPtrs, i, relocateTokenPointer(rawPointer(fieldPtrs, i), oldPtr, oldCap, p));
  }
  if (oldPtr != 0) heap.free(oldPtr);
  tokenPtr = p;
  tokenCap = next;
  return true;
}

function relocateTokenPointer(value: usize, oldPtr: usize, oldCap: usize, nextPtr: usize): usize {
  if (value >= oldPtr && value < oldPtr + oldCap) return nextPtr + (value - oldPtr);
  return value;
}

function ensureState(required: usize): bool {
  if (statePtr != 0 && required <= stateCap) return true;
  let next: usize = stateCap == 0 ? 512 : stateCap;
  while (next < required) {
    if (next > 0x3fffffff) return false;
    next *= 2;
  }
  const p = allocRaw(next);
  if (p == 0) return false;
  const oldPtr = statePtr;
  const oldCap = stateCap;
  if (oldPtr != 0 && stateUsed != 0) copyBytes(p, oldPtr, stateUsed);
  if (oldPtr != 0) {
    xmlUriPtr = relocateStatePointer(xmlUriPtr, oldPtr, oldCap, p);
    xmlnsUriPtr = relocateStatePointer(xmlnsUriPtr, oldPtr, oldCap, p);
    declarationVersionPtr = relocateStatePointer(declarationVersionPtr, oldPtr, oldCap, p);
    declarationEncodingPtr = relocateStatePointer(declarationEncodingPtr, oldPtr, oldCap, p);
    doctypeRootPtr = relocateStatePointer(doctypeRootPtr, oldPtr, oldCap, p);
    pendingNamePtr = relocateStatePointer(pendingNamePtr, oldPtr, oldCap, p);
    pendingLocalPtr = relocateStatePointer(pendingLocalPtr, oldPtr, oldCap, p);
    pendingPrefixPtr = relocateStatePointer(pendingPrefixPtr, oldPtr, oldCap, p);
    pendingUriPtr = relocateStatePointer(pendingUriPtr, oldPtr, oldCap, p);
    for (let i = 0; i < 13; i++) setRawPointer(fieldPtrs, i, relocateStatePointer(rawPointer(fieldPtrs, i), oldPtr, oldCap, p));
    for (let i = 0; i < stackDepth; i++) {
      setRawPointer(stackName, i, relocateStatePointer(rawPointer(stackName, i), oldPtr, oldCap, p));
      setRawPointer(stackLocal, i, relocateStatePointer(rawPointer(stackLocal, i), oldPtr, oldCap, p));
      setRawPointer(stackPrefix, i, relocateStatePointer(rawPointer(stackPrefix, i), oldPtr, oldCap, p));
      setRawPointer(stackUri, i, relocateStatePointer(rawPointer(stackUri, i), oldPtr, oldCap, p));
    }
    for (let i = 0; i < nsCount; i++) {
      setRawPointer(nsPrefix, i, relocateStatePointer(rawPointer(nsPrefix, i), oldPtr, oldCap, p));
      setRawPointer(nsUri, i, relocateStatePointer(rawPointer(nsUri, i), oldPtr, oldCap, p));
    }
    for (let i = 0; i < currentAttrCount; i++) {
      setRawPointer(attrUri, i, relocateStatePointer(rawPointer(attrUri, i), oldPtr, oldCap, p));
    }
    for (let i = 0; i < entityCount; i++) {
      setRawPointer(entityName, i, relocateStatePointer(rawPointer(entityName, i), oldPtr, oldCap, p));
      setRawPointer(entityValue, i, relocateStatePointer(rawPointer(entityValue, i), oldPtr, oldCap, p));
    }
  }
  if (oldPtr != 0) heap.free(oldPtr);
  statePtr = p;
  stateCap = next;
  return true;
}

function relocateStatePointer(value: usize, oldPtr: usize, oldCap: usize, nextPtr: usize): usize {
  if (value >= oldPtr && value < oldPtr + oldCap) return nextPtr + (value - oldPtr);
  return value;
}

function stateCopy(src: usize, length: usize): usize {
  const p = statePtr + stateUsed;
  if (!ensureState(stateUsed + length)) return 0;
  const out = statePtr + stateUsed;
  copyBytes(out, src, length);
  stateUsed += length;
  return out;
}

function stateCopyLiteral(value: string): usize {
  const n = value.length;
  if (!ensureState(stateUsed + n)) return 0;
  const p = statePtr + stateUsed;
  for (let i = 0; i < n; i++) store<u8>(p + i, <u8>value.charCodeAt(i));
  stateUsed += n;
  return p;
}

function ensureStack(required: i32): bool {
  if (required <= stackCap) return true;
  let next = stackCap == 0 ? 8 : stackCap;
  while (next < required) next *= 2;
  const a = allocRaw(<usize>next * 4); const b = allocRaw(<usize>next * 4);
  const c = allocRaw(<usize>next * 4); const d = allocRaw(<usize>next * 4);
  const e = allocRaw(<usize>next * 4); const f = allocRaw(<usize>next * 4);
  const g = allocRaw(<usize>next * 4); const h = allocRaw(<usize>next * 4);
  const j = allocRaw(<usize>next * 4); const k = allocRaw(<usize>next * 4);
  if (a == 0 || b == 0 || c == 0 || d == 0 || e == 0 || f == 0 || g == 0 || h == 0 || j == 0 || k == 0) return false;
  for (let i = 0; i < stackDepth; i++) {
    setRawPointer(a, i, rawPointer(stackName, i)); setRawInt(b, i, rawInt(stackNameLen, i)); setRawPointer(c, i, rawPointer(stackLocal, i)); setRawInt(d, i, rawInt(stackLocalLen, i));
    setRawPointer(e, i, rawPointer(stackPrefix, i)); setRawInt(f, i, rawInt(stackPrefixLen, i)); setRawPointer(g, i, rawPointer(stackUri, i)); setRawInt(h, i, rawInt(stackUriLen, i));
    setRawInt(j, i, rawInt(stackUndo, i)); setRawPointer(k, i, rawPointer(stackMark, i));
  }
  const oldA = stackName; const oldB = stackNameLen; const oldC = stackLocal; const oldD = stackLocalLen;
  const oldE = stackPrefix; const oldF = stackPrefixLen; const oldG = stackUri; const oldH = stackUriLen;
  const oldJ = stackUndo; const oldK = stackMark;
  stackName = a; stackNameLen = b; stackLocal = c; stackLocalLen = d; stackPrefix = e; stackPrefixLen = f;
  stackUri = g; stackUriLen = h; stackUndo = j; stackMark = k; stackCap = next;
  if (oldA != 0) heap.free(oldA); if (oldB != 0) heap.free(oldB); if (oldC != 0) heap.free(oldC); if (oldD != 0) heap.free(oldD);
  if (oldE != 0) heap.free(oldE); if (oldF != 0) heap.free(oldF); if (oldG != 0) heap.free(oldG); if (oldH != 0) heap.free(oldH);
  if (oldJ != 0) heap.free(oldJ); if (oldK != 0) heap.free(oldK);
  return true;
}

function ensureNamespaces(required: i32): bool {
  if (required <= nsCap) return true;
  let next = nsCap == 0 ? 8 : nsCap;
  while (next < required) next *= 2;
  const a = allocRaw(<usize>next * 4); const b = allocRaw(<usize>next * 4);
  const c = allocRaw(<usize>next * 4); const d = allocRaw(<usize>next * 4);
  if (a == 0 || b == 0 || c == 0 || d == 0) return false;
  for (let i = 0; i < nsCount; i++) { setRawPointer(a, i, rawPointer(nsPrefix, i)); setRawInt(b, i, rawInt(nsPrefixLen, i)); setRawPointer(c, i, rawPointer(nsUri, i)); setRawInt(d, i, rawInt(nsUriLen, i)); }
  const oldA = nsPrefix; const oldB = nsPrefixLen; const oldC = nsUri; const oldD = nsUriLen;
  nsPrefix = a; nsPrefixLen = b; nsUri = c; nsUriLen = d; nsCap = next;
  if (oldA != 0) heap.free(oldA); if (oldB != 0) heap.free(oldB); if (oldC != 0) heap.free(oldC); if (oldD != 0) heap.free(oldD);
  return true;
}

function ensureAttributes(required: i32): bool {
  if (required <= attrCap) return true;
  let next = attrCap == 0 ? 8 : attrCap;
  while (next < required) next *= 2;
  const a = allocRaw(<usize>next * 4); const b = allocRaw(<usize>next * 4);
  const c = allocRaw(<usize>next * 4); const d = allocRaw(<usize>next * 4);
  const e = allocRaw(<usize>next * 4); const f = allocRaw(<usize>next * 4); const g = allocRaw(<usize>next * 4);
  if (a == 0 || b == 0 || c == 0 || d == 0 || e == 0 || f == 0 || g == 0) return false;
  for (let i = 0; i < currentAttrCount; i++) {
    setRawPointer(a, i, rawPointer(attrName, i)); setRawInt(b, i, rawInt(attrNameLen, i)); setRawPointer(c, i, rawPointer(attrValue, i)); setRawInt(d, i, rawInt(attrValueLen, i)); setRawInt(e, i, rawInt(attrColon, i)); setRawPointer(f, i, rawPointer(attrUri, i)); setRawInt(g, i, rawInt(attrUriLen, i));
  }
  const oldA = attrName; const oldB = attrNameLen; const oldC = attrValue; const oldD = attrValueLen;
  const oldE = attrColon; const oldF = attrUri; const oldG = attrUriLen;
  attrName = a; attrNameLen = b; attrValue = c; attrValueLen = d; attrColon = e; attrUri = f; attrUriLen = g; attrCap = next;
  if (oldA != 0) heap.free(oldA); if (oldB != 0) heap.free(oldB); if (oldC != 0) heap.free(oldC); if (oldD != 0) heap.free(oldD);
  if (oldE != 0) heap.free(oldE); if (oldF != 0) heap.free(oldF); if (oldG != 0) heap.free(oldG);
  return true;
}

function ensureEntities(required: i32): bool {
  if (required <= entityCap) return true;
  let next = entityCap == 0 ? 8 : entityCap;
  while (next < required) next *= 2;
  const a = allocRaw(<usize>next * 4); const b = allocRaw(<usize>next * 4);
  const c = allocRaw(<usize>next * 4); const d = allocRaw(<usize>next * 4);
  if (a == 0 || b == 0 || c == 0 || d == 0) return false;
  for (let i = 0; i < entityCount; i++) { setRawPointer(a, i, rawPointer(entityName, i)); setRawInt(b, i, rawInt(entityNameLen, i)); setRawPointer(c, i, rawPointer(entityValue, i)); setRawInt(d, i, rawInt(entityValueLen, i)); }
  const oldA = entityName; const oldB = entityNameLen; const oldC = entityValue; const oldD = entityValueLen;
  entityName = a; entityNameLen = b; entityValue = c; entityValueLen = d; entityCap = next;
  if (oldA != 0) heap.free(oldA); if (oldB != 0) heap.free(oldB); if (oldC != 0) heap.free(oldC); if (oldD != 0) heap.free(oldD);
  return true;
}

function byteAt(p: usize, index: usize): u8 { return load<u8>(p + index); }
function inputByte(index: usize): u8 { return load<u8>(inputPtr + index); }

function readCodePoint(p: usize, end: usize): i32 {
  lastWidth = utf8Width(p, end);
  return utf8ReadCodePoint(p, end);
}

function xmlChar(cp: i32): bool { return utf8XmlChar(cp); }
function asciiLetter(cp: i32): bool { return utf8AsciiLetter(cp); }
function nameStart(cp: i32): bool { return utf8NameStart(cp); }
function namePart(cp: i32): bool { return utf8NamePart(cp); }
function whitespace(cp: i32): bool { return cp == 32 || cp == 9 || cp == 10 || cp == 13; }
function trimWhitespace(cp: i32): bool { return whitespace(cp) || cp == 0xa0 || cp == 0x1680 || (cp >= 0x2000 && cp <= 0x200a) || cp == 0x2028 || cp == 0x2029 || cp == 0x202f || cp == 0x205f || cp == 0x3000 || cp == 0xfeff; }
function previousCodePointStart(start: usize, end: usize): usize {
  let p = end;
  if (p > start) p--;
  while (p > start && (load<u8>(inputPtr + p) & 0xc0) == 0x80) p--;
  return p;
}

function eqLiteral(p: usize, n: i32, value: string): bool {
  if (n != value.length) return false;
  for (let i = 0; i < n; i++) if (load<u8>(p + i) != <u8>value.charCodeAt(i)) return false;
  return true;
}
function eqInput(start: usize, n: i32, value: string): bool { return eqLiteral(inputPtr + start, n, value); }
function spanEqual(a: usize, an: i32, b: usize, bn: i32): bool {
  if (an != bn) return false;
  for (let i = 0; i < an; i++) if (load<u8>(a + i) != load<u8>(b + i)) return false;
  return true;
}
function spanEqualInput(a: usize, an: i32, b: usize, bn: i32): bool { return spanEqual(inputPtr + a, an, inputPtr + b, bn); }

function encodeCodePoint(cp: i32, out: usize): i32 {
  if (cp < 0x80) { store<u8>(out, <u8>cp); return 1; }
  if (cp < 0x800) { store<u8>(out, <u8>(0xc0 | (cp >> 6))); store<u8>(out + 1, <u8>(0x80 | (cp & 63))); return 2; }
  if (cp < 0x10000) { store<u8>(out, <u8>(0xe0 | (cp >> 12))); store<u8>(out + 1, <u8>(0x80 | ((cp >> 6) & 63))); store<u8>(out + 2, <u8>(0x80 | (cp & 63))); return 3; }
  store<u8>(out, <u8>(0xf0 | (cp >> 18))); store<u8>(out + 1, <u8>(0x80 | ((cp >> 12) & 63))); store<u8>(out + 2, <u8>(0x80 | ((cp >> 6) & 63))); store<u8>(out + 3, <u8>(0x80 | (cp & 63))); return 4;
}

function findEntity(namePtr: usize, nameLen: i32): i32 {
  for (let i = 0; i < entityCount; i++) if (spanEqual(namePtr, nameLen, rawPointer(entityName, i), rawInt(entityNameLen, i))) return i;
  return -1;
}
function entityNameValid(p: usize, n: i32): bool {
  if (n <= 0) return false;
  let at: usize = 0;
  const end = <usize>n;
  let cp = readCodePoint(p, p + end);
  if (cp < 0 || !nameStart(cp)) return false;
  at += lastWidth;
  while (at < end) {
    cp = readCodePoint(p + at, p + end);
    if (cp < 0 || (!nameStart(cp) && !namePart(cp))) return false;
    at += lastWidth;
  }
  return true;
}

function numericEntity(p: usize, n: i32): i32 {
  if (n < 2 || load<u8>(p) != 35) return -1;
  let at: i32 = 1;
  let base: i32 = 10;
  if (at < n && load<u8>(p + at) == 120) { base = 16; at++; }
  if (at >= n) return -1;
  let value: i32 = 0;
  for (; at < n; at++) {
    const c = <i32>load<u8>(p + at);
    let d = -1;
    if (c >= 48 && c <= 57) d = c - 48;
    else if (base == 16 && c >= 65 && c <= 70) d = c - 55;
    else if (base == 16 && c >= 97 && c <= 102) d = c - 87;
    if (d < 0 || d >= base || value > 0x10ffff / base) return -1;
    value = value * base + d;
  }
  return xmlChar(value) ? value : -1;
}

function decodeEntity(namePtr: usize, nameLen: i32, attribute: bool, out: usize, write: bool): bool {
  if (eqLiteral(namePtr, nameLen, "lt")) { if (write) store<u8>(out, 60); decodeResultLen = 1; return true; }
  if (eqLiteral(namePtr, nameLen, "gt")) { if (write) store<u8>(out, 62); decodeResultLen = 1; return true; }
  if (eqLiteral(namePtr, nameLen, "amp")) { if (write) store<u8>(out, 38); decodeResultLen = 1; return true; }
  if (eqLiteral(namePtr, nameLen, "quot")) { if (write) store<u8>(out, 34); decodeResultLen = 1; return true; }
  if (eqLiteral(namePtr, nameLen, "apos")) { if (write) store<u8>(out, 39); decodeResultLen = 1; return true; }
  const cp = numericEntity(namePtr, nameLen);
  if (cp >= 0) {
    if (write) decodeResultLen = encodeCodePoint(cp, out);
    else decodeResultLen = cp < 0x80 ? 1 : (cp < 0x800 ? 2 : (cp < 0x10000 ? 3 : 4));
    return true;
  }
  const index = findEntity(namePtr, nameLen);
  if (index < 0) return false;
  const valuePtr = rawPointer(entityValue, index);
  const valueLen = rawInt(entityValueLen, index);
  if (attribute) {
    for (let i = 0; i < valueLen; i++) if (load<u8>(valuePtr + i) == 60) return false;
  }
  if (write) copyBytes(out, valuePtr, <usize>valueLen);
  decodeResultLen = valueLen;
  return true;
}

// Validate XML chars and entities; decode into `out` when write=true.
function decodeSpan(src: usize, length: i32, attribute: bool, out: usize, write: bool): bool {
  let i: i32 = 0;
  let written: i32 = 0;
  decodeHadEntity = false;
  while (i < length) {
    if (ASC_FEATURE_SIMD && i + 16 <= length) {
      const block = v128.load(src + <usize>i);
      let stop = i8x16.bitmask(block) | i8x16.bitmask(
        v128.or(i8x16.lt_u(block, i8x16.splat(32)), i8x16.eq(block, i8x16.splat(38))),
      );
      if (attribute) stop |= i8x16.bitmask(i8x16.eq(block, i8x16.splat(60)));
      const asciiLength = stop == 0 ? 16 : ctz<i32>(stop);
      if (asciiLength != 0) {
        if (write) {
          if (asciiLength == 16) v128.store(out + <usize>written, block);
          else copyBytes(out + <usize>written, src + <usize>i, <usize>asciiLength);
        }
        i += asciiLength;
        written += asciiLength;
        continue;
      }
    }
    const cp = readCodePoint(src + <usize>i, src + <usize>length);
    if (cp < 0 || !xmlChar(cp)) {
      fail("Invalid XML character.");
      return false;
    }
    const width = lastWidth;
    if (attribute && cp == 60) return false;
    if (cp == 38) {
      decodeHadEntity = true;
      let semi = i + 1;
      while (semi < length && load<u8>(src + <usize>semi) != 59) semi++;
      if (semi >= length) {
        fail("Unterminated entity reference.");
        return false;
      }
      const nameLen = semi - i - 1;
      if (!decodeEntity(src + <usize>(i + 1), nameLen, attribute, write ? out + <usize>written : 0, write)) {
        fail("Unknown or invalid entity.");
        return false;
      }
      written += decodeResultLen;
      i = semi + 1;
    } else {
      if (write) copyBytes(out + <usize>written, src + <usize>i, <usize>width);
      written += width;
      i += width;
    }
  }
  decodeResultLen = written;
  return true;
}

function validateXmlSpan(src: usize, length: i32): bool {
  let i: i32 = 0;
  while (i < length) {
    const cp = readCodePoint(src + <usize>i, src + <usize>length);
    if (cp < 0 || !xmlChar(cp)) return false;
    i += lastWidth;
  }
  return true;
}

function compactInput(): void {
  if (inputPos == 0) return;
  const remain = inputLen - inputPos;
  copyBytes(inputPtr, inputPtr + inputPos, remain);
  inputBase += <i32>inputPos;
  inputLen = remain;
  inputPos = 0;
}

function beginResume(kind: i32): void {
  if (resumeKind == kind) return;
  resumeKind = kind;
  resumeOffset = 0;
  resumeQuote = 0;
  resumeBrackets = 0;
  resumeComment = false;
}

function finishResume(): void {
  resumeKind = RESUME_NONE;
  resumeOffset = 0;
  resumeQuote = 0;
  resumeBrackets = 0;
  resumeComment = false;
}

function markerPrefix(start: usize, length: i32, marker: string): bool {
  return scanMarkerPrefix(start, length, marker);
}

function findSequence(start: usize, end: usize, a: u8, b: u8, c: u8 = 0, sequenceWidth: i32 = 2): i32 {
  const result = scanFindSequence(inputPtr + start, inputPtr + end, a, b, c, sequenceWidth);
  return result < 0 ? -1 : result - <i32>inputPtr;
}

function findTagEnd(): i32 {
  const result = scanFindTagEnd(inputPtr + inputPos + 1, inputPtr + inputLen, inputPtr + inputPos + 1 + resumeOffset, resumeQuote);
  if (result >= 0) {
    resumeOffset = 0;
    resumeQuote = 0;
    return result - <i32>inputPtr;
  }
  resumeOffset = inputLen - inputPos - 1;
  resumeQuote = result == -1 ? 0 : -2 - result;
  return -1;
}

function scanName(start: usize, end: usize): i32 {
  parseNameError = false;
  const result = scanScanName(inputPtr + start, inputPtr + end);
  if (result < 0) parseNameError = true;
  return result < 0 ? -1 : result - <i32>inputPtr;
}
function qnameParts(start: usize, end: usize, colonOut: i32 = 0): i32 {
  const result = scanQnameColon(inputPtr + start, inputPtr + end);
  return result < 0 ? result : result - <i32>inputPtr;
}
function scanInvalidName(start: usize, end: usize): i32 {
  let at = start;
  while (at < end) { const b = inputByte(at); if (whitespace(b) || b == 47 || b == 62 || b == 61) break; at++; }
  return <i32>(at - start);
}

function attrIsNamespace(index: i32): bool {
  const n = rawInt(attrNameLen, index);
  const p = inputPtr + rawPointer(attrName, index);
  const colon = rawInt(attrColon, index);
  if (colon < 0) return eqLiteral(p, n, XMLNS);
  return colon == <i32>rawPointer(attrName, index) + 5 && eqLiteral(p, 5, XMLNS);
}
function nsLookup(prefixPtr: usize, prefixLen: i32): i32 {
  if (!namespaceAware) return -1;
  if (eqLiteral(prefixPtr, prefixLen, "xml")) return -2;
  for (let i = nsCount - 1; i >= 0; i--) if (spanEqual(prefixPtr, prefixLen, rawPointer(nsPrefix, i), rawInt(nsPrefixLen, i))) return i;
  return -1;
}
function nsUriFor(prefixPtr: usize, prefixLen: i32): usize {
  const i = nsLookup(prefixPtr, prefixLen);
  if (i == -2) return xmlUriPtr;
  if (i < 0) return 0;
  return rawPointer(nsUri, i);
}
function nsUriLenFor(prefixPtr: usize, prefixLen: i32): i32 {
  const i = nsLookup(prefixPtr, prefixLen);
  if (i == -2) return <i32>XML_URI.length;
  if (i < 0) return -1;
  return rawInt(nsUriLen, i);
}

function bindNamespace(prefixPtr: usize, prefixLen: i32, uriPtr: usize, uriLen: i32): bool {
  if (eqLiteral(prefixPtr, prefixLen, "xmlns") || eqLiteral(uriPtr, uriLen, XMLNS_URI)) return false;
  const isXml = eqLiteral(prefixPtr, prefixLen, "xml");
  if (isXml != eqLiteral(uriPtr, uriLen, XML_URI)) return false;
  if (prefixLen > 0 && uriLen == 0) return false;
  if (!ensureNamespaces(nsCount + 1)) return false;
  setRawPointer(nsPrefix, nsCount, stateCopy(prefixPtr, <usize>prefixLen));
  setRawInt(nsPrefixLen, nsCount, prefixLen);
  setRawPointer(nsUri, nsCount, uriPtr);
  setRawInt(nsUriLen, nsCount, uriLen);
  if (rawPointer(nsPrefix, nsCount) == 0 || rawPointer(nsUri, nsCount) == 0) return false;
  nsCount++;
  return true;
}

function resetEvent(type: i32): void {
  const previousLocalPtr = rawPointer(fieldPtrs, 2);
  const previousLocalLen = rawInt(fieldLens, 2);
  const previousPrefixPtr = rawPointer(fieldPtrs, 3);
  const previousPrefixLen = rawInt(fieldLens, 3);
  const previousUriPtr = rawPointer(fieldPtrs, 4);
  const previousUriLen = rawInt(fieldLens, 4);
  zeroFields();
  currentType = type;
  currentEvent++;
  currentSelfClosing = false;
  if (type != START_ELEMENT) currentAttrCount = 0;
  if (type != START_ELEMENT && type != END_ELEMENT && type != PI) {
    setRawPointer(fieldPtrs, 0, 0);
    setRawInt(fieldLens, 0, -1);
  }
  if (type == START_ELEMENT || type == END_ELEMENT || type == PI) {
    setRawInt(fieldLens, 3, 0);
    setRawInt(fieldLens, 4, 0);
  }
  if (type == PI) {
    setRawPointer(fieldPtrs, 2, previousLocalPtr);
    setRawInt(fieldLens, 2, previousLocalLen);
    setRawPointer(fieldPtrs, 3, previousPrefixPtr);
    setRawInt(fieldLens, 3, previousPrefixLen);
    setRawPointer(fieldPtrs, 4, previousUriPtr);
    setRawInt(fieldLens, 4, previousUriLen);
  }
}

function emitText(type: i32, start: i32, end: i32): i32 {
  if (end < start) end = start;
  if (!decodeSpan(inputPtr + <usize>start, end - start, false, 0, false)) return fail("Invalid XML character.", inputBase + start);
  const decodedLength = decodeResultLen;
  const needsDecode = decodeHadEntity;
  currentAttrCount = 0;
  tokenUsed = 0;
  resetEvent(type);
  if (type == CHARACTERS && autoDecode && needsDecode) {
    if (!ensureToken(<usize>decodedLength)) return fail("Tokenizer memory exhausted.");
    tokenUsed = 0;
    if (!decodeSpan(inputPtr + <usize>start, end - start, false, tokenPtr, true)) return fail("Invalid entity reference.");
    tokenUsed = <usize>decodeResultLen;
    setRawPointer(fieldPtrs, 1, tokenPtr); setRawInt(fieldLens, 1, <i32>tokenUsed);
  } else {
    setRawPointer(fieldPtrs, 1, inputPtr + <usize>start); setRawInt(fieldLens, 1, end - start);
  }
  inputPos = <usize>end;
  declarationAllowed = false;
  return type;
}

function parseText(): i32 {
  beginResume(RESUME_TEXT);
  if (declarationAllowed && stackDepth == 0 && roots == 0) declarationAllowed = false;
  const start = <i32>inputPos;
  const scanStart = inputPos + resumeOffset;
  let end = -1;
  for (let i = scanStart; i < inputLen; i++) if (inputByte(i) == 60) { end = <i32>i; break; }
  if (end < 0) {
    if (!isFinal) { resumeOffset = inputLen - inputPos; return NEED; }
    end = <i32>inputLen;
  }
  if (documentMode == 1 && stackDepth == 0) {
    for (let i = start; i < end; i++) if (!whitespace(inputByte(i))) return fail("Character data is not allowed outside the root element.", inputBase + i);
  }
  const bad = findSequence(<usize>start, <usize>end, 93, 93, 62, 3);
  if (bad >= 0) return fail("Character data cannot contain ]]>", inputBase + bad);
  if (end == start) return NEED;
  if (!isFinal && end == <i32>inputLen) {
    // Keep text until a markup boundary so a token never changes after it is exposed.
    resumeOffset = inputLen - inputPos;
    return NEED;
  }
  finishResume();
  return emitText(CHARACTERS, start, end);
}

function parseComment(): i32 {
  beginResume(RESUME_COMMENT);
  const contentStart = inputPos + 4;
  const scanStart = contentStart + (resumeOffset > 2 ? resumeOffset - 2 : 0);
  const end = findSequence(scanStart, inputLen, 45, 45, 62, 3);
  if (end < 0) {
    if (!isFinal) { resumeOffset = inputLen - contentStart; return NEED; }
    return fail("Unterminated comment.");
  }
  const bad = findSequence(inputPos + 4, <usize>end + 1, 45, 45, 0, 2);
  if (bad >= 0) return fail("XML comments must not contain \"--\".", inputBase + bad);
  if (!validateXmlSpan(inputPtr + inputPos + 4, <i32>(end - <i32>inputPos - 4))) return fail("Invalid XML character.");
  currentAttrCount = 0;
  tokenUsed = 0;
  resetEvent(COMMENT);
  setRawPointer(fieldPtrs, 1, inputPtr + inputPos + 4);
  setRawInt(fieldLens, 1, end - <i32>inputPos - 4);
  inputPos = <usize>end + 3;
  declarationAllowed = false;
  finishResume();
  return COMMENT;
}

function parseCdata(): i32 {
  beginResume(RESUME_CDATA);
  const contentStart = inputPos + 9;
  const scanStart = contentStart + (resumeOffset > 2 ? resumeOffset - 2 : 0);
  const end = findSequence(scanStart, inputLen, 93, 93, 62, 3);
  if (end < 0) {
    if (!isFinal) { resumeOffset = inputLen - contentStart; return NEED; }
    return fail("Unterminated CDATA.");
  }
  if (!validateXmlSpan(inputPtr + inputPos + 9, <i32>(end - <i32>inputPos - 9))) return fail("Invalid XML character.");
  if (documentMode == 1 && stackDepth == 0) return fail("CDATA is not allowed outside the root element.");
  currentAttrCount = 0;
  tokenUsed = 0;
  resetEvent(CDATA);
  setRawPointer(fieldPtrs, 1, inputPtr + inputPos + 9);
  setRawInt(fieldLens, 1, end - <i32>inputPos - 9);
  inputPos = <usize>end + 3;
  declarationAllowed = false;
  finishResume();
  return CDATA;
}

function parseDoctype(): i32 {
  if (seenDoctype || roots != 0 || stackDepth != 0) return fail("DOCTYPE must appear once before the root element.");
  beginResume(RESUME_DOCTYPE);
  const contentStart = inputPos + 2;
  let quote: i32 = resumeQuote;
  let brackets: i32 = resumeBrackets;
  let inComment: bool = resumeComment;
  let end = -1;
  let i = contentStart + resumeOffset;
  for (; i < inputLen; i++) {
    const b = <i32>inputByte(i);
    if (inComment) {
      if (b == 45 && i + 2 >= inputLen && !isFinal) break;
      if (b == 45 && i + 2 < inputLen && inputByte(i + 1) == 45 && inputByte(i + 2) == 62) {
        inComment = false;
        i += 2;
      }
      continue;
    }
    if (quote != 0) { if (b == quote) quote = 0; continue; }
    if (b == 60 && i + 3 >= inputLen && !isFinal) break;
    if (b == 34 || b == 39) quote = b;
    else if (b == 60 && i + 3 < inputLen && inputByte(i + 1) == 33 && inputByte(i + 2) == 45 && inputByte(i + 3) == 45) {
      inComment = true;
      i += 3;
    }
    else if (b == 91) brackets++;
    else if (b == 93) {
      if (brackets == 0) return fail("Invalid DOCTYPE.");
      brackets--;
    }
    else if (b == 62 && brackets == 0) { end = <i32>i; break; }
  }
  if (end < 0) {
    if (!isFinal) {
      // Save the first unprocessed byte: replaying brackets or quotes changes state.
      resumeOffset = i - contentStart;
      resumeQuote = quote;
      resumeBrackets = brackets;
      resumeComment = inComment;
      return NEED;
    }
    return fail("Unterminated DOCTYPE.");
  }
  if (!validateXmlSpan(inputPtr + inputPos + 2, <i32>(end - <i32>inputPos - 2))) return fail("Invalid XML character.");
  const rootStart = inputPos + 9;
  let s = rootStart;
  while (s < <usize>end && whitespace(inputByte(s))) s++;
  const rootEnd = scanName(s, <usize>end);
  if (rootEnd < 0 || rootEnd == <i32>s) return fail("Invalid DOCTYPE root name.", inputBase + <i32>s);
  doctypeRootPtr = stateCopy(inputPtr + s, <usize>(rootEnd - <i32>s));
  doctypeRootLen = rootEnd - <i32>s;
  if (doctypeRootPtr == 0) return fail("Tokenizer memory exhausted.");
  seenDoctype = true;
  declarationAllowed = false;
  currentAttrCount = 0;
  tokenUsed = 0;
  resetEvent(DTD);
  setRawPointer(fieldPtrs, 1, inputPtr + inputPos + 2);
  setRawInt(fieldLens, 1, end - <i32>inputPos - 2);
  inputPos = <usize>end + 1;
  finishResume();
  return DTD;
}

function parseDeclarationBody(start: usize, end: usize): bool {
  let p = start;
  while (p < end && whitespace(readCodePoint(inputPtr + p, inputPtr + end))) p += <usize>lastWidth;
  if (end - p < 7 || !eqLiteral(inputPtr + p, 7, "version")) return false;
  p += 7;
  while (p < end && whitespace(readCodePoint(inputPtr + p, inputPtr + end))) p += <usize>lastWidth;
  if (p >= end || inputByte(p) != 61) return false; p++;
  while (p < end && whitespace(readCodePoint(inputPtr + p, inputPtr + end))) p += <usize>lastWidth;
  if (p >= end || (inputByte(p) != 34 && inputByte(p) != 39)) return false;
  const q = inputByte(p++); const vs = p;
  while (p < end && inputByte(p) != q) p++;
  if (p - vs != 3 || !eqLiteral(inputPtr + vs, 3, "1.0")) return false;
  if (p >= end) return false; p++;
  let encodingStart: usize = 0; let encodingLen: i32 = -1;
  let standalone: i32 = -1;
  while (p < end) {
    if (!whitespace(inputByte(p))) return false;
    while (p < end && whitespace(readCodePoint(inputPtr + p, inputPtr + end))) p += <usize>lastWidth;
    if (p >= end) break;
    if (end - p >= 8 && eqLiteral(inputPtr + p, 8, "encoding")) {
      if (encodingLen >= 0 || standalone >= 0) return false;
      p += 8; while (p < end && whitespace(readCodePoint(inputPtr + p, inputPtr + end))) p += <usize>lastWidth;
      if (p >= end || inputByte(p) != 61) return false; p++; while (p < end && whitespace(readCodePoint(inputPtr + p, inputPtr + end))) p += <usize>lastWidth;
      if (p >= end || (inputByte(p) != 34 && inputByte(p) != 39)) return false;
      const eq = inputByte(p++); const es = p; while (p < end && inputByte(p) != eq) p++;
      if (p <= es || p >= end || !asciiLetter(inputByte(es))) return false;
      for (let i = es + 1; i < p; i++) { const c = inputByte(i); if (!(asciiLetter(c) || (c >= 48 && c <= 57) || c == 46 || c == 95 || c == 45)) return false; }
      encodingStart = es; encodingLen = <i32>(p - es); p++;
    } else if (end - p >= 10 && eqLiteral(inputPtr + p, 10, "standalone")) {
      if (standalone >= 0) return false;
      p += 10; while (p < end && whitespace(readCodePoint(inputPtr + p, inputPtr + end))) p += <usize>lastWidth;
      if (p >= end || inputByte(p) != 61) return false; p++; while (p < end && whitespace(readCodePoint(inputPtr + p, inputPtr + end))) p += <usize>lastWidth;
      if (p >= end || (inputByte(p) != 34 && inputByte(p) != 39)) return false;
      const sq = inputByte(p++); const ss = p; while (p < end && inputByte(p) != sq) p++;
      if (p - ss == 3 && eqLiteral(inputPtr + ss, 3, "yes")) standalone = 1;
      else if (p - ss == 2 && eqLiteral(inputPtr + ss, 2, "no")) standalone = 0;
      else return false;
      if (p >= end) return false; p++;
    } else return false;
  }
  declarationVersionPtr = stateCopyLiteral("1.0");
  declarationEncodingPtr = 0;
  declarationEncodingLen = -1;
  if (encodingLen >= 0) { declarationEncodingPtr = stateCopy(inputPtr + encodingStart, <usize>encodingLen); declarationEncodingLen = encodingLen; }
  declarationStandaloneValue = standalone;
  declarationStandaloneStored = standalone;
  inputPos = <usize>end + 2;
  declarationAllowed = false;
  return true;
}

function parsePi(): i32 {
  beginResume(RESUME_PI);
  const contentStart = inputPos + 2;
  const scanStart = contentStart + (resumeOffset > 1 ? resumeOffset - 1 : 0);
  const end = findSequence(scanStart, inputLen, 63, 62, 0, 2);
  if (end < 0) {
    if (!isFinal) { resumeOffset = inputLen - contentStart; return NEED; }
    return fail("Unterminated processing instruction.");
  }
  const content = inputPos + 2;
  let targetEnd = content;
  while (targetEnd < <usize>end && !whitespace(inputByte(targetEnd))) {
    const cp = readCodePoint(inputPtr + targetEnd, inputPtr + <usize>end);
    if (cp < 0) return fail("Invalid processing instruction target.");
    targetEnd += <usize>lastWidth;
  }
  const targetLen = <i32>(targetEnd - content);
  if (targetLen <= 0 || scanName(content, <usize>end) < 0) return fail("Invalid processing instruction target.");
  if (eqLiteral(inputPtr + content, targetLen, "xml")) {
    if (!declarationAllowed || !parseDeclarationBody(targetEnd, <usize>end)) return fail("Invalid or misplaced XML declaration.");
    finishResume();
    return NO;
  }
  if (targetLen == 3 && (inputByte(content) == 88 || inputByte(content) == 120) && (inputByte(content + 1) == 77 || inputByte(content + 1) == 109) && (inputByte(content + 2) == 76 || inputByte(content + 2) == 108)) return fail("Invalid or misplaced XML declaration.");
  if (!validateXmlSpan(inputPtr + content, <i32>(end - <i32>content))) return fail("Invalid XML character.");
  let s = <usize>end;
  while (s > targetEnd) {
    const trimStart = previousCodePointStart(targetEnd, s);
    const trimCodePoint = readCodePoint(inputPtr + trimStart, inputPtr + s);
    if (!trimWhitespace(trimCodePoint)) break;
    s = trimStart;
  }
  let dataStart = targetEnd;
  while (dataStart < s) {
    const cp = readCodePoint(inputPtr + dataStart, inputPtr + s);
    if (!trimWhitespace(cp)) break;
    dataStart += <usize>lastWidth;
  }
  currentAttrCount = 0;
  tokenUsed = 0;
  resetEvent(PI);
  setRawPointer(fieldPtrs, 0, inputPtr + content); setRawInt(fieldLens, 0, targetLen);
  setRawPointer(fieldPtrs, 1, inputPtr + dataStart); setRawInt(fieldLens, 1, <i32>(s - dataStart));
  inputPos = <usize>end + 2;
  declarationAllowed = false;
  finishResume();
  return PI;
}

function parseBang(): i32 {
  const remain = <i32>(inputLen - inputPos);
  if (remain >= 4 && eqInput(inputPos, 4, "<!--")) return parseComment();
  if (remain >= 9 && eqInput(inputPos, 9, "<![CDATA[")) return parseCdata();
  if (remain >= 9 && eqInput(inputPos, 9, "<!DOCTYPE")) {
    if (inputPos + 9 >= inputLen && !isFinal) return NEED;
    const b = inputByte(inputPos + 9);
    if (b == 62 || whitespace(b)) return parseDoctype();
  }
  if (!isFinal && (markerPrefix(inputPtr + inputPos, remain, "<!--") || markerPrefix(inputPtr + inputPos, remain, "<![CDATA[") || markerPrefix(inputPtr + inputPos, remain, "<!DOCTYPE"))) return NEED;
  return fail("Unsupported XML declaration.");
}

function parseEnd(): i32 {
  beginResume(RESUME_END);
  let end = inputPos + 2 + resumeOffset;
  while (end < inputLen && inputByte(end) != 62) end++;
  if (end == inputLen) {
    if (!isFinal) { resumeOffset = inputLen - inputPos - 2; return NEED; }
    return fail("Unterminated end tag.");
  }
  const start = inputPos + 2;
  if (start >= <usize>end || whitespace(inputByte(start))) return fail("Invalid end tag.");
  let nameEnd = <usize>end;
  while (nameEnd > start && whitespace(inputByte(nameEnd - 1))) nameEnd--;
  if (stackDepth <= 0) return fail("Mismatched end tag.");
  const top = stackDepth - 1;
  if (!spanEqual(inputPtr + start, <i32>(nameEnd - start), rawPointer(stackName, top), rawInt(stackNameLen, top))) return fail("Mismatched end tag.");
  resetEvent(END_ELEMENT);
  setRawPointer(fieldPtrs, 0, rawPointer(stackName, top)); setRawInt(fieldLens, 0, rawInt(stackNameLen, top));
  setRawPointer(fieldPtrs, 2, rawPointer(stackLocal, top)); setRawInt(fieldLens, 2, rawInt(stackLocalLen, top));
  setRawPointer(fieldPtrs, 3, rawPointer(stackPrefix, top)); setRawInt(fieldLens, 3, rawInt(stackPrefixLen, top));
  setRawPointer(fieldPtrs, 4, rawPointer(stackUri, top)); setRawInt(fieldLens, 4, rawInt(stackUriLen, top));
  pendingUndo = rawInt(stackUndo, top); pendingState = rawPointer(stackMark, top);
  stackDepth--;
  inputPos = <usize>end + 1;
  finishResume();
  return END_ELEMENT;
}

function parseStart(): i32 {
  beginResume(RESUME_START);
  const end = findTagEnd();
  if (end < 0) return isFinal ? fail("Unterminated start tag.") : NEED;
  const tagEnd = <usize>end;
  const nameStart = inputPos + 1;
  let cursor = nameStart;
  const nameEnd = scanName(cursor, tagEnd);
  if (nameEnd < 0 || nameEnd == <i32>nameStart) return fail("Invalid XML name.", inputBase + <i32>nameStart);
  cursor = <usize>nameEnd;
  const qualifiedNameLength = <i32>(cursor - nameStart);
  const nameColon = qnameParts(nameStart, cursor);
  if (nameColon == -2) return fail("Invalid XML name.", inputBase + <i32>nameStart);
  tokenUsed = 0;
  currentAttrCount = 0;
  let selfClosing = false;
  while (cursor < tagEnd) {
    while (cursor < tagEnd && whitespace(inputByte(cursor))) cursor++;
    if (cursor >= tagEnd) break;
    if (inputByte(cursor) == 47) {
      selfClosing = true; cursor++;
      if (cursor != tagEnd) return fail("Invalid start tag.");
      break;
    }
    const attrStart = cursor;
    const attrEnd = scanName(cursor, tagEnd);
    if (attrEnd < 0 || attrEnd == <i32>attrStart) return fail("Invalid XML name.", inputBase + <i32>attrStart);
    cursor = <usize>attrEnd;
    const attrNameLength = <i32>(cursor - attrStart);
    const colon = qnameParts(attrStart, cursor);
    if (colon == -2) return fail("Invalid XML name.", inputBase + <i32>attrStart);
    while (cursor < tagEnd && whitespace(inputByte(cursor))) cursor++;
    if (cursor >= tagEnd || inputByte(cursor) != 61) return fail("Attribute requires a value.");
    cursor++; while (cursor < tagEnd && whitespace(inputByte(cursor))) cursor++;
    if (cursor >= tagEnd || (inputByte(cursor) != 34 && inputByte(cursor) != 39)) return fail("Attribute must be quoted.");
    const quote = inputByte(cursor++); const valueStart = cursor;
    while (cursor < tagEnd && inputByte(cursor) != quote) cursor++;
    if (cursor >= tagEnd) return fail("Unterminated attribute value.");
    const valueEnd = cursor++;
    if (cursor < tagEnd && !whitespace(inputByte(cursor)) && inputByte(cursor) != 47) return fail("Attributes must be separated by whitespace.");
    if (!ensureAttributes(currentAttrCount + 1)) return fail("Tokenizer memory exhausted.");
    for (let i = 0; i < currentAttrCount; i++) {
      if (rawInt(attrNameLen, i) == attrNameLength && spanEqual(inputPtr + attrStart, attrNameLength, inputPtr + rawPointer(attrName, i), rawInt(attrNameLen, i)))
        return fail("Duplicate attribute.");
    }
    const index = currentAttrCount++;
    setRawPointer(attrName, index, attrStart); setRawInt(attrNameLen, index, attrNameLength);
    setRawPointer(attrValue, index, inputPtr + valueStart); setRawInt(attrValueLen, index, <i32>(valueEnd - valueStart)); setRawInt(attrColon, index, colon);
  }
  // Namespace binding and public attribute URI calculation.
  const nsUndo = nsCount;
  const mark = stateUsed;
  let localStart = nameColon < 0 ? nameStart : <usize>nameColon + 1;
  const prefixLen = nameColon < 0 ? 0 : nameColon - <i32>nameStart;
  const localLen = <i32>(<usize>nameEnd - localStart);
  if (namespaceAware) {
    for (let i = 0; i < currentAttrCount; i++) if (attrIsNamespace(i)) {
      const attrNameOffset = rawPointer(attrName, i);
      const attrNameLength = rawInt(attrNameLen, i);
      const attrColonOffset = rawInt(attrColon, i);
      const cp: usize = attrColonOffset < 0 ? 0 : attrNameOffset + 6;
      const plen = attrColonOffset < 0 ? 0 : attrNameLength - 6;
      if (!decodeSpan(rawPointer(attrValue, i), rawInt(attrValueLen, i), true, 0, false)) {
        stateUsed = mark;
        nsCount = nsUndo;
        return fail("Invalid namespace URI.");
      }
      const uriLength = decodeResultLen;
      if (!ensureState(stateUsed + <usize>uriLength + <usize>attrNameLength + 8)) return fail("Tokenizer memory exhausted.");
      const uriOut = statePtr + stateUsed;
      if (!decodeSpan(rawPointer(attrValue, i), rawInt(attrValueLen, i), true, uriOut, true)) { stateUsed = mark; nsCount = nsUndo; return fail("Invalid namespace URI."); }
      stateUsed += <usize>uriLength;
      if (!bindNamespace(inputPtr + cp, <i32>plen, uriOut, uriLength)) { stateUsed = mark; nsCount = nsUndo; return fail("Invalid namespace binding."); }
    }
  }
  // Reserve the complete frame before capturing any state-arena pointers.
  // A state growth relocates retained spans, so locals must only be captured after it.
  if (!ensureState(stateUsed + <usize>qualifiedNameLength + 8))
    return fail("Tokenizer memory exhausted.");
  let uriPtr: usize = 0; let uriLen: i32 = 0;
  if (namespaceAware) {
    if (nameColon >= 0) { uriPtr = nsUriFor(inputPtr + nameStart, prefixLen); uriLen = nsUriLenFor(inputPtr + nameStart, prefixLen); if (uriPtr == 0 || uriLen < 0) { stateUsed = mark; nsCount = nsUndo; return fail("Undeclared namespace prefix."); } }
    else { const idx = nsLookup(0, 0); if (idx >= 0) { uriPtr = rawPointer(nsUri, idx); uriLen = rawInt(nsUriLen, idx); } }
  }
  if (uriPtr == 0 && namespaceAware) { uriPtr = stateCopyLiteral(""); uriLen = 0; }
  // Copy the frame into retained state before current input may be compacted.
  const frameName = stateCopy(inputPtr + nameStart, <usize>qualifiedNameLength);
  const frameLocal = frameName + <usize>(localStart - nameStart);
  const framePrefix = frameName;
  const frameUri = uriPtr;
  if (frameName == 0 || frameLocal == 0 || framePrefix == 0) { stateUsed = mark; nsCount = nsUndo; return fail("Tokenizer memory exhausted."); }
  for (let i = 0; i < currentAttrCount; i++) {
    if (namespaceAware) {
      if (attrIsNamespace(i)) { setRawPointer(attrUri, i, xmlnsUriPtr); setRawInt(attrUriLen, i, <i32>XMLNS_URI.length); }
      else if (rawInt(attrColon, i) >= 0) {
        const pp = inputPtr + rawPointer(attrName, i); const pn = rawInt(attrColon, i) - <i32>rawPointer(attrName, i);
        setRawPointer(attrUri, i, nsUriFor(pp, pn)); setRawInt(attrUriLen, i, nsUriLenFor(pp, pn));
        if (rawPointer(attrUri, i) == 0 || rawInt(attrUriLen, i) < 0) { stateUsed = mark; nsCount = nsUndo; return fail("Undeclared namespace prefix."); }
      } else { setRawPointer(attrUri, i, 0); setRawInt(attrUriLen, i, 0); }
    } else { setRawPointer(attrUri, i, 0); setRawInt(attrUriLen, i, 0); }
    if (!decodeSpan(rawPointer(attrValue, i), rawInt(attrValueLen, i), true, 0, false))
      return fail("Invalid attribute value.");
    if (autoDecode && decodeHadEntity) {
      const decodedLength = decodeResultLen;
      const out = tokenUsed; if (!ensureToken(tokenUsed + <usize>decodedLength)) return fail("Tokenizer memory exhausted.");
      if (!decodeSpan(rawPointer(attrValue, i), rawInt(attrValueLen, i), true, tokenPtr + out, true)) return fail("Invalid attribute entity.");
      setRawPointer(attrValue, i, tokenPtr + out); setRawInt(attrValueLen, i, decodedLength); tokenUsed += <usize>decodedLength;
    }
  }
  if (namespaceAware) {
    for (let i = 0; i < currentAttrCount; i++) {
      if (attrIsNamespace(i) || rawInt(attrColon, i) < 0) continue;
      const localOffset = rawInt(attrColon, i) - <i32>rawPointer(attrName, i) + 1;
      const localLength = rawInt(attrNameLen, i) - localOffset;
      for (let j = 0; j < i; j++) {
        if (attrIsNamespace(j)) continue;
        const jLocalOffset = rawInt(attrColon, j) < 0 ? 0 : rawInt(attrColon, j) - <i32>rawPointer(attrName, j) + 1;
        const jLocalLength = rawInt(attrNameLen, j) - jLocalOffset;
        if (rawInt(attrUriLen, i) == rawInt(attrUriLen, j) &&
            spanEqual(rawPointer(attrUri, i), rawInt(attrUriLen, i), rawPointer(attrUri, j), rawInt(attrUriLen, j)) &&
            localLength == jLocalLength &&
            spanEqualInput(rawPointer(attrName, i) + <usize>localOffset, localLength, rawPointer(attrName, j) + <usize>jLocalOffset, jLocalLength))
          return fail("Duplicate expanded attribute.");
      }
    }
  }
  if (stackDepth == 0) {
    declarationAllowed = false;
    if (doctypeRootLen >= 0 && !spanEqual(inputPtr + nameStart, qualifiedNameLength, doctypeRootPtr, doctypeRootLen)) return fail("DOCTYPE root does not match root element.");
    roots++;
  }
  resetEvent(START_ELEMENT);
  setRawPointer(fieldPtrs, 0, inputPtr + nameStart); setRawInt(fieldLens, 0, qualifiedNameLength);
  setRawPointer(fieldPtrs, 2, frameLocal); setRawInt(fieldLens, 2, localLen);
  setRawPointer(fieldPtrs, 3, framePrefix); setRawInt(fieldLens, 3, prefixLen);
  setRawPointer(fieldPtrs, 4, frameUri); setRawInt(fieldLens, 4, uriLen);
  currentSelfClosing = selfClosing;
  if (!selfClosing) {
    if (!ensureStack(stackDepth + 1)) return fail("Tokenizer memory exhausted.");
    setRawPointer(stackName, stackDepth, frameName); setRawInt(stackNameLen, stackDepth, qualifiedNameLength);
    setRawPointer(stackLocal, stackDepth, frameLocal); setRawInt(stackLocalLen, stackDepth, localLen);
    setRawPointer(stackPrefix, stackDepth, framePrefix); setRawInt(stackPrefixLen, stackDepth, prefixLen);
    setRawPointer(stackUri, stackDepth, frameUri); setRawInt(stackUriLen, stackDepth, uriLen);
    setRawInt(stackUndo, stackDepth, nsUndo); setRawPointer(stackMark, stackDepth, mark); stackDepth++;
  } else {
    pendingEnd = true; pendingNamePtr = frameName; pendingNameLen = qualifiedNameLength; pendingLocalPtr = frameLocal; pendingLocalLen = localLen; pendingPrefixPtr = framePrefix; pendingPrefixLen = prefixLen; pendingUriPtr = frameUri; pendingUriLen = uriLen; pendingUndo = nsUndo; pendingState = mark;
  }
  inputPos = tagEnd + 1;
  finishResume();
  return START_ELEMENT;
}

function prepareStartDocument(): bool {
  if (leadingPending) {
    while (leadingBomCount < 2 && inputLen - inputPos >= 3 && inputByte(inputPos) == 0xef && inputByte(inputPos + 1) == 0xbb && inputByte(inputPos + 2) == 0xbf) {
      inputPos += 3;
      leadingBomCount++;
    }
    if (!isFinal && inputLen - inputPos < 3) {
      const available = inputLen - inputPos;
      if (available == 0 || (available == 1 && inputByte(inputPos) == 0xef) ||
          (available == 2 && inputByte(inputPos) == 0xef && inputByte(inputPos + 1) == 0xbb))
        return false;
    }
    leadingPending = false;
  }
  const available = inputLen - inputPos;
  if (available < 5) {
    if (isFinal) return true;
    if (markerPrefix(inputPtr + inputPos, <i32>available, XML_TARGET)) return false;
    return true;
  }
  if (!eqInput(inputPos, 5, XML_TARGET)) return true;
  if (inputPos + 5 >= inputLen) return isFinal;
  if (!whitespace(inputByte(inputPos + 5))) return true;
  return true;
}

function nextInternal(): i32 {
  if (errorKind != 0) return ERROR;
  if (pendingUndo >= 0 && !pendingEnd) { nsCount = pendingUndo; stateUsed = pendingState; pendingUndo = -1; }
  if (!initialized || disposed) return EOF;
  if (!started) {
    if (!prepareStartDocument()) return NEED;
    if (inputLen - inputPos >= 6 && eqInput(inputPos, 5, XML_TARGET) && whitespace(inputByte(inputPos + 5))) {
      const declarationResult = parsePi();
      if (declarationResult == NEED || declarationResult == ERROR) return declarationResult;
      if (declarationResult != NO) return declarationResult;
    }
    started = true;
    resetEvent(START_DOCUMENT);
    if (declarationVersionPtr != 0) {
      setRawPointer(fieldPtrs, 10, declarationVersionPtr);
      setRawInt(fieldLens, 10, 3);
      setRawPointer(fieldPtrs, 11, declarationEncodingPtr);
      setRawInt(fieldLens, 11, declarationEncodingLen);
    }
    declarationStandaloneValue = declarationStandaloneStored;
    return START_DOCUMENT;
  }
  if (pendingEnd) {
    pendingEnd = false;
    resetEvent(END_ELEMENT);
    setRawPointer(fieldPtrs, 0, pendingNamePtr); setRawInt(fieldLens, 0, pendingNameLen);
    setRawPointer(fieldPtrs, 2, pendingLocalPtr); setRawInt(fieldLens, 2, pendingLocalLen);
    setRawPointer(fieldPtrs, 3, pendingPrefixPtr); setRawInt(fieldLens, 3, pendingPrefixLen);
    setRawPointer(fieldPtrs, 4, pendingUriPtr); setRawInt(fieldLens, 4, pendingUriLen);
    pendingUndo = pendingUndo; // retained until next call, after END accessors are read.
    return END_ELEMENT;
  }
  if (ended) return EOF;
  while (true) {
    if (inputPos >= inputLen) {
      if (!isFinal) return NEED;
      if (stackDepth > 0) return fail("Unclosed element.");
      if (documentMode == 1 && roots != 1) return fail("XML document must contain exactly one root element.");
      ended = true;
      currentAttrCount = 0;
      tokenUsed = 0;
      resetEvent(END_DOCUMENT);
      if (inputPtr != 0) heap.free(inputPtr);
      inputPtr = 0;
      inputCap = 0;
      inputLen = 0;
      inputPos = 0;
      return END_DOCUMENT;
    }
    if (inputByte(inputPos) != 60) return parseText();
    if (inputPos + 1 >= inputLen && !isFinal) return NEED;
    const next = inputByte(inputPos + 1);
    if (next == 47) return parseEnd();
    if (next == 63) { const pi = parsePi(); if (pi == NO) continue; return pi; }
    if (next == 33) return parseBang();
    if (documentMode == 1 && stackDepth == 0 && roots == 1) return fail("XML document must contain exactly one root element.");
    return parseStart();
  }
}

export function initialize(mode: i32, nsAware: i32, decode: i32): void {
  releaseOwned();
  leadingBomCount = 0;
  disposed = false; initialized = true; documentMode = mode; namespaceAware = nsAware != 0; autoDecode = decode != 0;
  isFinal = false; inputPtr = 0; inputCap = 0; inputLen = 0; inputPos = 0; inputBase = 0; reserved = 0;
  resetUtf8(); started = false; ended = false; leadingPending = true; roots = 0; declarationAllowed = true; seenDoctype = false; doctypeRootPtr = 0; doctypeRootLen = -1;
  currentType = START_DOCUMENT; currentEvent = 0; pendingEnd = false; pendingUndo = -1; pendingState = 0; resumeKind = RESUME_NONE; resumeOffset = 0; resumeQuote = 0; resumeBrackets = 0; resumeComment = false; errorKind = 0; errorAt = -1; errorMessagePtr = 0; errorMessageLen = 0;
  tokenPtr = 0; tokenCap = 0; tokenUsed = 0; statePtr = 0; stateCap = 0; stateUsed = 0; stateFloor = 0; scratchPtr = 0; scratchCap = 0;
  fieldPtrs = allocRaw(13 * 4);
  fieldLens = allocRaw(13 * 4);
  tokenHeader = allocRaw(13 * 4);
  stackCap = 0; stackDepth = 0; stackName = 0; stackNameLen = 0; stackLocal = 0; stackLocalLen = 0; stackPrefix = 0; stackPrefixLen = 0; stackUri = 0; stackUriLen = 0; stackUndo = 0; stackMark = 0;
  nsCap = 0; nsCount = 0; nsPrefix = 0; nsPrefixLen = 0; nsUri = 0; nsUriLen = 0;
  attrCap = 0; currentAttrCount = 0; attrName = 0; attrNameLen = 0; attrValue = 0; attrValueLen = 0; attrColon = 0; attrUri = 0; attrUriLen = 0;
  entityCap = 0; entityCount = 0; entityName = 0; entityNameLen = 0; entityValue = 0; entityValueLen = 0;
  declarationVersionPtr = 0; declarationEncodingPtr = 0; declarationEncodingLen = -1; declarationStandaloneStored = -1;
  zeroFields();
  xmlUriPtr = stateCopyLiteral(XML_URI); xmlnsUriPtr = stateCopyLiteral(XMLNS_URI); stateFloor = stateUsed;
  if (namespaceAware && ensureNamespaces(1)) { setRawPointer(nsPrefix, 0, stateCopyLiteral("xml")); setRawInt(nsPrefixLen, 0, 3); setRawPointer(nsUri, 0, xmlUriPtr); setRawInt(nsUriLen, 0, <i32>XML_URI.length); nsCount = 1; }
}

export function reserve(length: i32): usize {
  if (!initialized || disposed || isFinal || length < 0 || errorKind != 0) return 0;
  compactInput();
  const want = inputLen + <usize>length;
  if (want > inputCap) {
    let next: usize = inputCap == 0 ? 256 : inputCap;
    while (next < want) { if (next > 0x3fffffff) { setError(ERROR_STATE, inputBase, "Tokenizer memory exhausted."); return 0; } next *= 2; }
    const p = allocRaw(next);
    if (p == 0) { setError(ERROR_STATE, inputBase, "Tokenizer memory exhausted."); return 0; }
    const oldPtr = inputPtr;
    if (oldPtr != 0 && inputLen != 0) copyBytes(p, oldPtr, inputLen);
    if (oldPtr != 0) heap.free(oldPtr);
    inputPtr = p; inputCap = next;
  }
  reserved = <usize>length;
  return inputPtr + inputLen;
}

export function commit(length: i32, final: i32): i32 {
  if (!initialized || disposed || isFinal || errorKind != 0 || length < 0 || <usize>length > reserved) return ERROR;
  const start = inputPtr + inputLen;
  if (!appendValid(start, <usize>length, final != 0)) return failUtf8(<i32>(inputLen));
  inputLen += <usize>length; reserved = 0; isFinal = final != 0;
  return 0;
}

export function next(): i32 { return nextInternal(); }
export function tokenView(): usize {
  if (!initialized || disposed || tokenHeader == 0) return 0;
  store<i32>(tokenHeader, <i32>fieldPtrs);
  store<i32>(tokenHeader + 4, <i32>fieldLens);
  store<i32>(tokenHeader + 8, <i32>inputPtr);
  store<i32>(tokenHeader + 12, currentAttrCount);
  store<i32>(tokenHeader + 16, currentSelfClosing ? 1 : 0);
  store<i32>(tokenHeader + 20, declarationStandaloneValue);
  store<i32>(tokenHeader + 24, <i32>attrName);
  store<i32>(tokenHeader + 28, <i32>attrNameLen);
  store<i32>(tokenHeader + 32, <i32>attrValue);
  store<i32>(tokenHeader + 36, <i32>attrValueLen);
  store<i32>(tokenHeader + 40, <i32>attrColon);
  store<i32>(tokenHeader + 44, <i32>attrUri);
  store<i32>(tokenHeader + 48, <i32>attrUriLen);
  return tokenHeader;
}
export function lookupNamespace(ptr: usize, length: i32): void {
  setRawPointer(fieldPtrs, 12, 0); setRawInt(fieldLens, 12, 0);
  if (!namespaceAware || rawInt(fieldLens, 2) < 0) return;
  if (eqLiteral(ptr, length, "xml")) { setRawPointer(fieldPtrs, 12, xmlUriPtr); setRawInt(fieldLens, 12, <i32>XML_URI.length); return; }
  const i = nsLookup(ptr, length);
  if (i >= 0) { setRawPointer(fieldPtrs, 12, rawPointer(nsUri, i)); setRawInt(fieldLens, 12, rawInt(nsUriLen, i)); }
}
export function scratch(length: i32): usize {
  if (length < 0 || !initialized || disposed) return 0;
  const required = <usize>length;
  if (required <= scratchCap && scratchPtr != 0) return scratchPtr;
  let next: usize = scratchCap == 0 ? 64 : scratchCap;
  while (next < required) next *= 2;
  const p = scratchPtr == 0 ? heap.alloc(next) : heap.realloc(scratchPtr, next);
  if (p == 0) return 0;
  scratchPtr = p;
  scratchCap = next;
  return p;
}
export function addEntity(namePtr: usize, nameLen: i32, valuePtr: usize, valueLen: i32): i32 {
  if (!initialized || disposed || errorKind != 0 || nameLen <= 0 || valueLen < 0) return ERROR;
  let np = namePtr; let nn = nameLen;
  if (nn >= 2 && load<u8>(np) == 38 && load<u8>(np + <usize>nn - 1) == 59) { np++; nn -= 2; }
  if (!entityNameValid(np, nn)) return fail("Invalid custom entity name.");
  if (eqLiteral(np, nn, "lt") || eqLiteral(np, nn, "gt") || eqLiteral(np, nn, "amp") || eqLiteral(np, nn, "quot") || eqLiteral(np, nn, "apos")) return fail("Cannot override predefined XML entity.");
  if (findEntity(np, nn) >= 0) return fail("Duplicate custom entity.");
  if (!validateXmlSpan(valuePtr, valueLen)) return fail("Invalid XML character.");
  if (!ensureEntities(entityCount + 1)) return fail("Tokenizer memory exhausted.");
  if (!ensureState(stateUsed + <usize>nn + <usize>valueLen)) return fail("Tokenizer memory exhausted.");
  const n = stateCopy(np, <usize>nn); const v = stateCopy(valuePtr, <usize>valueLen);
  if (n == 0 || (valueLen > 0 && v == 0)) return fail("Tokenizer memory exhausted.");
  setRawPointer(entityName, entityCount, n); setRawInt(entityNameLen, entityCount, nn); setRawPointer(entityValue, entityCount, v); setRawInt(entityValueLen, entityCount, valueLen); entityCount++; stateFloor = stateUsed;
  return 0;
}
export function errorCode(): i32 { return errorKind; }
export function errorPosition(): i32 { return errorAt; }
export function errorPtr(): usize { return errorMessagePtr; }
export function errorLen(): i32 { return errorMessageLen; }
export function dispose(): void {
  if (disposed) return;
  releaseOwned();
  disposed = true;
  initialized = false;
  inputCap = 0;
  inputLen = 0;
  inputPos = 0;
  tokenCap = 0;
  stateCap = 0;
  scratchCap = 0;
}
export function inputCapacity(): i32 { return <i32>inputCap; }
