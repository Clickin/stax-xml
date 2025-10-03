# Implementation Plan: Enhance Test Coverage for Converter Module

**Branch**: `003-stax-xml-parser` | **Date**: 2025-10-03 | **Spec**: [spec.md](./spec.md)  
**Input**: `G:/programming/stax-xml/specs/003-stax-xml-parser/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ COMPLETE
2. Fill Technical Context
   → ✅ COMPLETE
3. Fill Constitution Check section
   → ✅ COMPLETE
4. Evaluate Constitution Check
   → ✅ PASS
5. Execute Phase 0 → research.md
   → ✅ COMPLETE
6. Execute Phase 1 → contracts, data-model.md, quickstart.md
   → ✅ COMPLETE
7. Re-evaluate Constitution Check
   → ✅ PASS
8. Plan Phase 2 → Describe task generation
   → ✅ COMPLETE
9. STOP - Ready for /tasks command
   → ✅ READY
```

## Summary

Achieve 95%+ test coverage (toward 100%) for converter module:
- **XmlParserInternal** (43.69% → 95%+) PRIORITY 1
- **XmlOptionalSchema** (57.14% → 95%+) PRIORITY 2
- **XmlStringSchema** (54.05% → 95%+) PRIORITY 3
- **XmlArraySchema** (64.55% → 95%+) PRIORITY 4

Test private methods through public APIs (TypeScript best practice). Focus on edge cases, error scenarios, sync/async paths. Graceful degradation with strict XML validation. Test execution <30s.

## Technical Context

**Language/Version**: TypeScript 5.9.2, ESM modules  
**Primary Dependencies**: Vitest 3.2.4, v8 coverage, tsdown 0.15.5  
**Storage**: N/A (library project)  
**Testing**: Vitest with describe/it/expect pattern  
**Target Platform**: Node.js ESM, Browser, Edge/Web runtimes  
**Project Type**: Single library (monorepo)  
**Performance Goals**: Test suite <30s, coverage computation <10s acceptable  
**Constraints**: Maintain existing patterns, no API breaking changes, deterministic tests  
**Scale/Scope**: 4 modules, ~500-1000 LOC tests, ~200-300 test cases

## Constitution Check

✅ **Test-First**: Tests define behavior, validate existing code  
✅ **Library-First**: Test enhancement only, no new libraries  
✅ **Simplicity**: Follow existing test/converter/ patterns  
✅ **Observability**: Vitest + v8 coverage output  
✅ **No Breaking Changes**: Tests validate existing behavior

**Status**: ✅ PASS

## Project Structure

### Documentation
```
specs/003-stax-xml-parser/
├── plan.md                         # This file
├── research.md                     # Phase 0 ✅
├── data-model.md                   # Phase 1 ✅
├── quickstart.md                   # Phase 1 ✅
├── contracts/                      # Phase 1 ✅
│   └── coverage-requirements.md
└── tasks.md                        # Phase 2 (created by /tasks command)
```

### Source Code
```
packages/stax-xml/
├── src/converter/
│   ├── XmlOptionalSchema.ts     # 57.14% → 95%+
│   ├── XmlParserInternal.ts     # 43.69% → 95%+
│   ├── XmlStringSchema.ts       # 54.05% → 95%+
│   └── XmlArraySchema.ts        # 64.55% → 95%+
└── test/converter/
    ├── optional-write.test.ts          # Expand
    ├── parser-internal.test.ts         # Expand significantly
    ├── string-position-parsing.test.ts # Expand
    └── array-position.test.ts          # Expand
```

**Structure Decision**: Monorepo library. Tests colocated in test/ mirroring src/. All converter tests in test/converter/ following describe/it/expect patterns.

## Phase 0: Outline & Research
**Status**: ✅ COMPLETE (see research.md)

**Key Findings**:
- Private methods tested through public API (TypeScript standard)
- Coverage gaps identified: XmlParserInternal (largest), XmlOptionalSchema, XmlStringSchema, XmlArraySchema
- Existing patterns documented: describe/it, arrange-act-assert, XML fixtures
- Performance acceptable: 538 tests in 3.75s (well under 30s target)

**Output**: G:/programming/stax-xml/specs/003-stax-xml-parser/research.md

## Phase 1: Design & Contracts
**Status**: ✅ COMPLETE

**Artifacts Created**:
- **data-model.md**: Test entities (Test Case, Coverage Gap, Test Suite, Schema Definition)
- **contracts/coverage-requirements.md**: Detailed test specifications for all 4 modules
- **quickstart.md**: Developer guide for running coverage and writing tests

**Output Files**:
- G:/programming/stax-xml/specs/003-stax-xml-parser/data-model.md
- G:/programming/stax-xml/specs/003-stax-xml-parser/contracts/coverage-requirements.md
- G:/programming/stax-xml/specs/003-stax-xml-parser/quickstart.md

## Phase 2: Task Planning Approach
*Executed by /tasks command - describing strategy*

**Task Generation Strategy**:
1. One task group per module (4 groups total)
2. Each task targets specific uncovered lines from coverage report
3. Tasks ordered by priority: XmlParserInternal → XmlOptionalSchema → XmlStringSchema → XmlArraySchema
4. Within module: parse methods → write methods → edge cases → error scenarios
5. Final verification task: run coverage, validate 95%+ threshold

**Ordering Strategy**:
- Sequential by priority (XmlParserInternal is core, blocks conceptually)
- Mark [P] for tests in different files (can work in parallel)
- Verification task depends on all test tasks completing

**Estimated Output**: 15-20 tasks
- 5-6 tasks: XmlParserInternal (largest gap: 43.69% → 95%+)
- 3-4 tasks: XmlOptionalSchema (gap: 57.14% → 95%+)
- 3-4 tasks: XmlStringSchema (gap: 54.05% → 95%+)
- 2-3 tasks: XmlArraySchema (gap: 64.55% → 95%+)
- 1 task: Coverage verification and reporting

**Sample Task Structure**:
```
## Task 001: Expand XmlParserInternal String Parsing Tests [P]
**Module**: XmlParserInternal
**Coverage Target**: Lines 56-118 (parseString methods)
**Test File**: packages/stax-xml/test/converter/parser-internal.test.ts

Acceptance Criteria:
- [ ] Test parseString without XPath (empty XML, whitespace, normal text)
- [ ] Test parseString with XPath (matching, non-matching, relative paths)
- [ ] Test parseStringAsync variants
- [ ] All tests pass
- [ ] Coverage for lines 56-118 reaches 95%+
```

## Phase 3+: Future Implementation
*Beyond /plan command scope*

**Phase 3**: /tasks command creates tasks.md  
**Phase 4**: Execute tasks following TDD principles  
**Phase 5**: Validate with `pnpm coverage`, verify 95%+ achieved

## Complexity Tracking
*No violations detected*

| Violation | Why Needed | Simpler Alternative |
|-----------|------------|---------------------|
| -         | -          | -                   |

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete ✅
- [x] Phase 1: Design complete ✅
- [x] Phase 2: Task planning approach described ✅
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation
- [ ] Phase 5: Validation

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] No complexity deviations

**Artifacts Generated**:
- [x] research.md (Phase 0)
- [x] data-model.md (Phase 1)
- [x] contracts/coverage-requirements.md (Phase 1)
- [x] quickstart.md (Phase 1)

**Coverage Progress** (updated during Phase 4):
- XmlOptionalSchema: 57.14% → [target: 95%+] → [TBD]
- XmlParserInternal: 43.69% → [target: 95%+] → [TBD]
- XmlStringSchema: 54.05% → [target: 95%+] → [TBD]
- XmlArraySchema: 64.55% → [target: 95%+] → [TBD]

---
**Plan Status**: ✅ COMPLETE  
**Branch**: 003-stax-xml-parser  
**Date**: 2025-10-03  
**Next Step**: Run `/tasks` command to generate tasks.md
