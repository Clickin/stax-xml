# Tasks: Enhance Test Coverage for Converter Module

**Input**: Design documents from `/specs/003-stax-xml-parser/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/coverage-requirements.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Tech stack: TypeScript 5.9.2, Vitest 3.2.4, v8 coverage
   → ✅ Structure: Monorepo library, tests in test/converter/
2. Load optional design documents:
   → ✅ data-model.md: Test Case, Coverage Gap, Test Suite entities
   → ✅ contracts/: coverage-requirements.md with 4 module contracts
   → ✅ research.md: Private method testing, existing patterns
3. Generate tasks by category:
   → Setup: Coverage baseline verification
   → Tests: Expand test coverage for 4 modules (priority order)
   → Validation: Final coverage verification
4. Apply task rules:
   → Different test files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests validate existing behavior (no implementation needed)
5. Number tasks sequentially (T001-T010)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → ✅ All contracts have corresponding test expansion tasks
   → ✅ All modules prioritized by coverage gap size
   → ✅ Final validation task present
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup & Baseline
- [ ] T001 Run coverage baseline and verify current state (43.69%, 57.14%, 54.05%, 64.55%)

## Phase 3.2: Test Coverage Expansion (Highest Priority First)

### XmlParserInternal (Priority 1: 43.69% → 95%+)
- [ ] T002 Expand string parsing tests in packages/stax-xml/test/converter/parser-internal.test.ts
  - Coverage target: Lines 56-118 (parseString/parseStringAsync without XPath)
  - Add tests: empty XML, whitespace-only, malformed XML errors
  - Add parseStringAsync variants (without XPath)
  - Verify private method extractXPath coverage via public API

- [ ] T003 Add object parsing tests in packages/stax-xml/test/converter/parser-internal.test.ts
  - Coverage target: Lines 142-212 (parseObject/parseObjectAsync)
  - Add tests: simple shape, nested objects without XPath, arrays without XPath
  - Add parseObjectAsync variants for all scenarios
  - Verify private methods (unwrapSchema, getAllTransforms) via public API

- [ ] T004 Add position-based parsing tests in packages/stax-xml/test/converter/parser-internal.test.ts
  - Coverage target: parseObjectFromPosition/parseArrayFromPosition methods
  - Add tests: sync position parsing, async position parsing
  - Test both object and array variants from position
  - Verify createCollectorForSchema/extractValueFromCollector via public API

### XmlOptionalSchema (Priority 2: 57.14% → 95%+)
- [ ] T005 [P] Expand optional schema tests in packages/stax-xml/test/converter/optional-write.test.ts
  - Coverage target: Lines 57, 65-66, 75-79
  - Add parse tests: undefined input (line 57), null input, valid value
  - Add parseAsync tests: undefined/null input (lines 65-66), async errors
  - Add parseText tests: undefined schema, errors, empty strings (lines 75-79)
  - Add write tests: undefined value, null value, writeAsync variants
  - Add edge cases: nested optional schemas, optional with transforms

### XmlStringSchema (Priority 3: 54.05% → 95%+)
- [ ] T006 [P] Expand string schema tests in packages/stax-xml/test/converter/string-position-parsing.test.ts
  - Coverage target: Lines 38-52, 55-77, 80-102
  - Add parseFromPosition tests: sync iterator (38-45), async iterator (46-52)
  - Add tests: nested elements, mixed content (text + elements)
  - Add XPath validation tests: empty string throws, valid path
  - Add write tests: root element, element config, writeAsync
  - Add writeContent tests: CDATA config, special XML chars escaping
  - Add text collection tests: nested depth sync/async, CDATA handling

### XmlArraySchema (Priority 4: 64.55% → 95%+)
- [ ] T007 [P] Expand array schema tests in packages/stax-xml/test/converter/array-position.test.ts
  - Coverage target: Lines 39-71
  - Add parseFromPosition tests: sync (39-50), async (51-65)
  - Add tests: nested arrays, complex element schemas
  - Add parseText test: returns empty array
  - Add write tests: empty array, multiple items, root element, writeAsync
  - Add edge cases: array without XPath throws, arrays with optional elements

## Phase 3.3: Validation & Verification
- [ ] T008 Run comprehensive coverage verification
  - Execute: pnpm coverage
  - Verify XmlParserInternal >= 95%
  - Verify XmlOptionalSchema >= 95%
  - Verify XmlStringSchema >= 95%
  - Verify XmlArraySchema >= 95%
  - Verify test suite execution < 30s
  - Document final coverage percentages in plan.md

- [ ] T009 Validate test quality and patterns
  - Verify all new tests follow existing patterns (describe/it/expect)
  - Verify no test uses (obj as any) to access private methods
  - Verify all tests are deterministic (run multiple times)
  - Verify test naming: "should [behavior] when [condition]"
  - Check for any flaky tests

- [ ] T010 Update documentation with results
  - Update plan.md with final coverage percentages
  - Document any remaining edge cases or limitations
  - Add notes for future maintenance in quickstart.md

## Dependencies
- T001 must complete before T002-T007 (baseline verification)
- T002-T007 can run in parallel (different test files marked [P])
- Note: T002, T003, T004 modify same file (parser-internal.test.ts) - must be sequential
- T005, T006, T007 are independent and can truly run in parallel [P]
- T008-T010 must complete after T002-T007 (validation phase)

## Parallel Execution Examples

### Phase 3.1 (Baseline)
```bash
# Single task, no parallelism
pnpm coverage
```

### Phase 3.2 (Expansion - Partial Parallelism)
```bash
# T002-T004 are sequential (same file: parser-internal.test.ts)
# Execute T002 first, then T003, then T004

# After T002-T004 complete, launch T005-T007 in parallel:
# Terminal 1
# Expand optional-write.test.ts (T005)

# Terminal 2
# Expand string-position-parsing.test.ts (T006)

# Terminal 3
# Expand array-position.test.ts (T007)
```

### Phase 3.3 (Validation)
```bash
# Sequential verification
pnpm coverage              # T008
# Review test patterns      # T009
# Update documentation      # T010
```

## Notes
- [P] tasks modify different files and have no dependencies
- T002-T004 are NOT marked [P] because they all modify packages/stax-xml/test/converter/parser-internal.test.ts
- T005-T007 ARE marked [P] because they modify different test files
- All tests validate existing behavior - no source code changes needed
- Follow existing patterns in test/converter/*.test.ts
- Private methods tested indirectly through public API
- Each test should follow arrange-act-assert structure
- Test names: "should [behavior] when [condition]"
- Verify deterministic execution (no flaky tests)
- Coverage target: 95%+ for all 4 modules
- Performance target: Total suite < 30s

## Task Details by Module

### T002: XmlParserInternal String Parsing (Lines 56-118)
**File**: packages/stax-xml/test/converter/parser-internal.test.ts

Test scenarios to add:
- parseString without XPath: empty XML, whitespace-only, normal text
- parseString without XPath: malformed XML error handling
- parseStringAsync without XPath: same scenarios as sync
- Indirect testing of extractXPath private method via various schemas
- Mixed content handling (text + child elements)

### T003: XmlParserInternal Object Parsing (Lines 142-212)
**File**: packages/stax-xml/test/converter/parser-internal.test.ts

Test scenarios to add:
- parseObject with simple shape (basic field extraction)
- parseObject with nested object without XPath
- parseObject with array fields without XPath
- parseObject with mixed schema types
- parseObjectAsync variants for all above scenarios
- Indirect testing of unwrapSchema and getAllTransforms private methods

### T004: XmlParserInternal Position Parsing
**File**: packages/stax-xml/test/converter/parser-internal.test.ts

Test scenarios to add:
- parseObjectFromPositionSync with various schemas
- parseObjectFromPosition async variants
- parseArrayFromPositionSync with simple and complex elements
- parseArrayFromPosition async variants
- Indirect testing of createCollectorForSchema and extractValueFromCollector

### T005: XmlOptionalSchema (Lines 57, 65-66, 75-79)
**File**: packages/stax-xml/test/converter/optional-write.test.ts

Test scenarios to add:
- _parse with undefined input (line 57)
- _parse with null input (line 57)
- _parse with valid value (lines 58-60)
- _parseAsync with undefined/null (line 65)
- _parseAsync error scenarios (lines 65-66)
- _parseText with undefined schema (line 75)
- _parseText with errors (lines 75-76)
- _parseText with empty string (lines 75-79)
- _write/_writeAsync with undefined/null values
- Nested optional schemas composition
- Optional schemas with transform functions

### T006: XmlStringSchema (Lines 38-52, 55-77, 80-102)
**File**: packages/stax-xml/test/converter/string-position-parsing.test.ts

Test scenarios to add:
- _parseFromPosition with sync iterator (lines 38-45)
- _parseFromPosition with async iterator (lines 46-52)
- _parseFromPosition with nested elements
- _parseFromPosition with mixed content (text + elements)
- XPath validation: empty string throws error
- XPath validation: valid path acceptance
- _write with root element configuration
- _write with element config (attributes, namespaces)
- _writeAsync variants
- _writeContent with CDATA configuration
- _writeContent with special XML characters (escaping)
- collectTextSync/collectTextAsync with deep nesting
- Text collection with CDATA sections

### T007: XmlArraySchema (Lines 39-71)
**File**: packages/stax-xml/test/converter/array-position.test.ts

Test scenarios to add:
- _parseFromPosition sync (lines 39-50)
- _parseFromPosition async (lines 51-65)
- Nested array structures
- Arrays with complex element schemas (objects, nested arrays)
- _parseText returning empty array
- _write with empty array
- _write with multiple items
- _write with root element wrapping
- _writeAsync variants
- Edge case: array without XPath throws error
- Arrays containing optional elements

## Validation Checklist
*Checked after task execution*

- [ ] All modules >= 95% coverage
- [ ] XmlParserInternal: 43.69% → 95%+ ✓
- [ ] XmlOptionalSchema: 57.14% → 95%+ ✓
- [ ] XmlStringSchema: 54.05% → 95%+ ✓
- [ ] XmlArraySchema: 64.55% → 95%+ ✓
- [ ] All tests follow existing patterns (describe/it/expect)
- [ ] No private method access via (obj as any)
- [ ] All tests deterministic (consistent pass/fail)
- [ ] Test suite execution < 30s
- [ ] Test naming follows "should [behavior] when [condition]"
- [ ] Each test has clear arrange-act-assert structure
- [ ] Coverage reports generated successfully
- [ ] Documentation updated with final results
