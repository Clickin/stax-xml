from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
header='''const work = (globalThis as typeof globalThis & { __hashWork: Record<string, any> }).__hashWork ??= { hashes: 0, scanCodeUnits: 0, narrowCodeUnits: 0, duplicateCandidates: 0, spanCalls: 0, spanCharacters: 0, lookupCalls: 0, wideCalls: 0, widths: {} as Record<string, number> };\n'''
s=header+s
replacements=[
('  return Math.imul(hash ^ code, 16777619) >>> 0;', '  work.hashes++;\n  return Math.imul(hash ^ code, 16777619) >>> 0;'),
('        attrHash = hashCode(attrHash, attrCode);','        work.scanCodeUnits += width;\n        if (rawCount < DUPLICATE_TABLE_THRESHOLD) work.narrowCodeUnits += width;\n        attrHash = hashCode(attrHash, attrCode);'),
('        for (let previous = 0; previous < rawCount; previous++) {','        for (let previous = 0; previous < rawCount; previous++) {\n          work.duplicateCandidates++;'),
('    const namespaceUndoStart = this.namespaceUndoLength;','    work.widths[rawCount] = (work.widths[rawCount] ?? 0) + 1;\n    const namespaceUndoStart = this.namespaceUndoLength;'),
('    const hash = hashString(indexOrName);','    work.lookupCalls++;\n    const hash = hashString(indexOrName);'),
('  private prepareDuplicateTable(count: number): DuplicateTable {','  private prepareDuplicateTable(count: number): DuplicateTable {\n    work.wideCalls++;'),
('  const length = aEnd - aStart;','  work.spanCalls++;\n  const length = aEnd - aStart;'),
('    if (text.charCodeAt(aStart + index) !== text.charCodeAt(bStart + index))','    if ((work.spanCharacters++, text.charCodeAt(aStart + index)) !== text.charCodeAt(bStart + index))')]
for a,b in replacements:
 assert s.count(a)==1,(a,s.count(a))
 s=s.replace(a,b)
p.write_text(s)
