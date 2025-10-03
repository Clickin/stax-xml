# Test Coverage Improvement Implementation Plan

**Goal**: Achieve 95%+ test coverage
**Current Coverage**: Core 91.62%, Converter 64.96%
**Target Coverage**: 97-98%
**Total Effort**: 15-17 hours, 59 test cases

---

## Status Dashboard

| Phase | Status | Coverage Gain | Test Cases | Effort |
|-------|--------|---------------|------------|--------|
| 1.1 - Number Validation | ✅ Complete | +5% | 37 | 1.5h |
| 1.2 - String Position | ⏳ Pending | +4% | 4 | 1h |
| 1.3 - Transform Errors | ⏳ Pending | +3% | 6 | 1h |
| 1.4 - Optional Write | ⏳ Pending | +2% | 6 | 45m |
| 2.1 - Array Position | ⏳ Pending | +3% | 4 | 2h |
| 2.2 - Object Position | ⏳ Pending | +5% | 9 | 2.5h |
| 2.3 - Parser Internal | ⏳ Pending | +7% | 8 | 3h |
| 3.1 - Writer Internal | ⏳ Pending | +5% | 9 | 1.5h |
| 4.1 - Advanced Integration | ⏳ Pending | +5% | 6 | 3h |

**Progress**: 37/59 tests completed (62.7%)

---

## Phase 1: Quick Wins - Validation & Error Handling

### Phase 1.1: XmlNumberSchema Validation ✅ **COMPLETE**

**File**: `test/converter/number-validation.test.ts`
**Target**: Lines 127-149, 159-160 in XmlNumberSchema.ts
**Actual Coverage**: +5% (XmlNumberSchema: 63.46% → 68.58%)

#### Test Cases (37 total):
1. ✅ Parse empty number content (throws) - 3 tests
2. ✅ Parse invalid number string (throws) - 3 tests
3. ✅ Validate min boundary (exact match) - 5 tests
4. ✅ Validate max boundary (exact match) - 5 tests
5. ✅ Integer validation with decimal (throws) - 5 tests
6. ✅ Async number parsing from stream - 4 tests
7. ✅ Number XPath empty string validation - 3 tests
8. ✅ Combined validation - 4 tests
9. ✅ Edge cases - 5 tests

**Success Criteria**: ✅ All 37 tests pass, coverage increased from 63.46% to 68.58%

---

### Phase 1.2: XmlStringSchema Position Parsing ⏳

**File**: `test/converter/string-position-parsing.test.ts`
**Target**: Lines 52, 55-77, 80-102 in XmlStringSchema.ts
**Expected Coverage**: +4%

#### Test Cases:
1. ✅ Parse string from nested array element (sync)
2. ✅ Parse string from nested array element (async)
3. ✅ String with nested child elements (mixed content)
4. ✅ XPath validation - empty string throws

**Success Criteria**: All 4 tests pass, sync/async paths covered

---

### Phase 1.3: XmlTransformSchema Error Paths ⏳

**File**: `test/converter/transform-errors.test.ts`
**Target**: Lines 43-61, 64-69, 77-78 in XmlTransformSchema.ts
**Expected Coverage**: +3%

#### Test Cases:
1. ✅ Transform without _parseFromPosition (throws)
2. ✅ Transform without _parseText (throws)
3. ✅ Transform _write throws error
4. ✅ Transform _writeAsync throws error
5. ✅ Promise-based transform in _parseFromPosition
6. ✅ Sync transform in _parseFromPosition

**Success Criteria**: All 6 tests pass, error paths validated

---

### Phase 1.4: XmlOptionalSchema Write Methods ⏳

**File**: `test/converter/optional-write.test.ts`
**Target**: Lines 57, 64-68, 75-79 in XmlOptionalSchema.ts
**Expected Coverage**: +2%

#### Test Cases:
1. ✅ Write undefined optional value (returns empty)
2. ✅ Write null optional value (returns empty)
3. ✅ Write valid optional value
4. ✅ Async write undefined optional
5. ✅ Async write valid optional
6. ✅ _parseText returns undefined on error

**Success Criteria**: All 6 tests pass, write operations covered

---

## Phase 2: Array & Object Position Parsing

### Phase 2.1: XmlArraySchema Position Parsing ⏳

**File**: `test/converter/array-position.test.ts`
**Target**: Lines 39-71, 76-77 in XmlArraySchema.ts
**Expected Coverage**: +3%

#### Test Cases:
1. ✅ Array _parseText (returns empty array)
2. ✅ Nested array in object (sync position parsing)
3. ✅ Nested array in object (async position parsing)
4. ✅ Array with async iterator detection

**Success Criteria**: All 4 tests pass, position parsing paths covered

---

### Phase 2.2: XmlObjectSchema Position & Write ⏳

**File**: `test/converter/object-position.test.ts`
**Target**: Lines 61-66, 75, 102-103, 115-116, 152, 155, 157, 225 in XmlObjectSchema.ts
**Expected Coverage**: +5%

#### Test Cases:
1. ✅ Object _parseText (returns empty object)
2. ✅ Object xpath validation (empty throws)
3. ✅ Object with async iterator (return check)
4. ✅ Nested object as array element (sync)
5. ✅ Nested object as array element (async)
6. ✅ Write object with undefined field values
7. ✅ Write object with attribute fields
8. ✅ Write object without _writeContent method
9. ✅ Object field with CDATA in _writeContent

**Success Criteria**: All 9 tests pass, object write paths covered

---

### Phase 2.3: XmlParserInternal Complex Scenarios ⏳

**File**: `test/converter/parser-internal.test.ts`
**Target**: Lines 252-271, 274-288, 323-363, 381-386, 401-425, 1198-1228 in XmlParserInternal.ts
**Expected Coverage**: +7%

#### Test Cases:
1. ✅ Parse object with nested object (no xpath on child)
2. ✅ Parse object with array (no xpath on array)
3. ✅ Sync version of nested object parsing
4. ✅ Sync version of nested array parsing
5. ✅ Parse object from position (sync, empty collector)
6. ✅ Parse object from position (async, empty collector)
7. ✅ Build result from collector with transforms
8. ✅ Create collector for unknown schema type

**Success Criteria**: All 8 tests pass, parser internal paths covered

---

## Phase 3: Writer Internal Methods

### Phase 3.1: XmlWriterInternal Edge Cases ⏳

**File**: `test/converter/writer-internal.test.ts`
**Target**: Lines 32, 41, 44, 90, 118-124, 170-193 in XmlWriterInternal.ts
**Expected Coverage**: +5%

#### Test Cases:
1. ✅ Write start document without version/encoding
2. ✅ Write element with comment config
3. ✅ Write element with namespace prefix
4. ✅ Write end element when stack is empty (throws)
5. ✅ Write end element updates indent
6. ✅ Write comment with pretty print
7. ✅ Build element tag with namespace
8. ✅ Build element tag with attributes
9. ✅ Build self-closing element tag

**Success Criteria**: All 9 tests pass, writer edge cases covered

---

## Phase 4: Complex Integration Scenarios

### Phase 4.1: Advanced Integration Tests ⏳

**File**: `test/converter/parser-advanced.test.ts`
**Target**: Lines 390-391, 457 in XmlParserInternal.ts + integration
**Expected Coverage**: +5%

#### Test Cases:
1. ✅ Deep nested object with relative XPaths
2. ✅ Array of arrays (nested arrays)
3. ✅ Object with all schema types as fields
4. ✅ Transform chain with optional wrapper
5. ✅ Large object with 20+ fields
6. ✅ Async parse from ReadableStream with chunks

**Success Criteria**: All 6 tests pass, complex scenarios validated

---

## Testing Strategy

### Private Method Testing Approach
- **Primary**: Test through public API (parseSync, parse, write, writeAsync)
- **Secondary**: Use integration tests with complex nested XML
- **Avoid**: Direct private method access or reflection

### Quality Checklist (Per Test)
- [ ] Descriptive test name (Given-When-Then)
- [ ] Arrange-Act-Assert pattern
- [ ] Tests behavior, not implementation
- [ ] Covers both happy path and error path
- [ ] Sync and async variants where applicable
- [ ] Realistic XML examples
- [ ] Specific assertions
- [ ] Deterministic (no timing dependencies)

---

## Validation After Each Phase

1. Run `pnpm test:coverage` to verify coverage increase
2. Check `packages/stax-xml/coverage/index.html` for details
3. Verify no flaky tests (run suite 3 times)
4. Ensure all existing tests still pass
5. Update this document with ✅ status

---

## Risk Mitigation

| Risk | Mitigation | Status |
|------|------------|--------|
| Private methods untestable via public API | Document and use `/* istanbul ignore */` | ✅ |
| Coverage tool counts unreachable code | Add ignore comments for defensive code | ⏳ |
| Tests become too complex | Keep simple, add helpers if needed | ⏳ |

---

## Final Success Criteria

- [ ] Line coverage: **95%+**
- [ ] Branch coverage: **90%+**
- [ ] Function coverage: **95%+**
- [ ] All tests pass: **100%**
- [ ] No flaky tests
- [ ] Test execution: **< 10 seconds**

---

**Last Updated**: 2025-10-03
**Status**: Phase 1.1 starting
**Next Step**: Implement number-validation.test.ts
