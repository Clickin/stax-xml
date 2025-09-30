
# Implementation Plan: Zod-Style Declarative XML Mapping with Separate Converter Package

**Branch**: `002-xpath-mapping-with` | **Date**: 2024-09-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-xpath-mapping-with/spec.md`
**Arguments**: REVISED APPROACH - Adopt Zod's schema syntax instead of XPath for declarative mapping. Split into two packages: `stax-xml` (zero dependencies) and `@stax-xml/converter` (with dependencies for advanced features). Both sync and async versions sharing XML event processing core.

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Implement a Zod-inspired declarative schema system for XML-to-object mapping with automatic TypeScript type inference. Split into two packages: core `stax-xml` (zero dependencies) for basic parsing, and `@stax-xml/converter` for advanced mapping features with dependencies. Both synchronous and asynchronous processing modes sharing the same XML event processing core.

## Technical Context
**Language/Version**: TypeScript 5.0+, Node.js 18+ (bun runtime at root)
**Primary Dependencies**:
  - Core package: Zero runtime dependencies
  - Converter package: Zod for inspiration, validation libraries allowed
**Storage**: N/A (library processes XML streams)
**Testing**: Existing test framework in project (bun test)
**Target Platform**: Node.js, Bun runtime, Web browsers (via bundling)
**Project Type**: monorepo (two packages: core + converter)
**Performance Goals**: <5ms schema compilation, 10MB/s throughput, constant memory usage during streaming
**Constraints**: Core package zero dependencies, converter package can have dependencies, backward compatibility
**Scale/Scope**: Library supporting XML files of any size through streaming, type-safe API for developers

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Product-Level Quality Gates (v2.0.0)
- [x] **100% Code Coverage**: Plan includes comprehensive test coverage for all code paths
- [x] **Readable Code**: Design includes clear documentation and commenting requirements
- [x] **Performance Excellence**: Performance impact assessment and benchmarking planned
- [x] **Library Architecture**: API design prioritizes developer experience and backward compatibility
- [x] **Comprehensive Testing**: All test types planned: unit, integration, edge cases, performance

### Quality Standards Compliance
- [x] **Test Strategy**: TDD approach with failing tests before implementation
- [x] **Error Handling**: All error conditions and edge cases identified for testing
- [x] **Performance Metrics**: Benchmarking strategy defined for critical paths
- [x] **Documentation Plan**: API documentation and examples planned for all public interfaces
- [x] **Review Process**: Code review and quality gate strategy defined

## Project Structure

### Documentation (this feature)
```
specs/002-xpath-mapping-with/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository structure for monorepo)
```
# Monorepo structure with two packages
packages/
├── stax-xml/            # Core package (zero dependencies)
│   ├── src/
│   │   ├── parser/
│   │   ├── writer/
│   │   ├── types/
│   │   └── index.ts
│   ├── tests/
│   └── package.json
└── converter/           # Converter package (@stax-xml/converter)
    ├── src/
    │   ├── schema/      # Zod-inspired schema system
    │   ├── mappers/     # Sync/async mappers
    │   ├── transforms/  # Data transformation utilities
    │   └── index.ts
    ├── tests/
    └── package.json

# Root level
├── package.json         # Workspace configuration
├── tsconfig.json        # Shared TypeScript config
└── README.md           # Documentation
```

**Structure Decision**: Monorepo with two packages - core parser (zero deps) + converter (with deps)

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Research Zod's schema design patterns and API structure
   - Research monorepo tooling for TypeScript packages
   - Research streaming schema validation techniques
   - Research zero-dependency TypeScript library patterns

2. **Generate and dispatch research agents**:
   ```
   Task: "Research Zod's schema definition patterns and type inference techniques for XML mapping adaptation"
   Task: "Research monorepo management for TypeScript packages with different dependency requirements"
   Task: "Research streaming schema validation and data mapping patterns"
   Task: "Research zero-dependency library architecture while maintaining extensibility"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all technical approaches researched and decided

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - XMLSchema interface (Zod-inspired for XML elements)
   - XMLElement, XMLAttribute, XMLText schema primitives
   - StreamingMapper and SyncMapper for processing
   - Package separation boundaries and interfaces

2. **Generate API contracts** from functional requirements:
   - Core package: Basic XML parsing/writing interfaces
   - Converter package: Schema definition and mapping interfaces
   - Inter-package communication contracts
   - Type inference system contracts

3. **Generate contract tests** from contracts:
   - Core package functionality tests
   - Converter package schema tests
   - Integration tests between packages
   - Type inference validation tests

4. **Extract test scenarios** from user stories:
   - Zod-style schema definition scenarios
   - Streaming processing scenarios
   - Package separation scenarios

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - Add monorepo, schema validation, and package separation context
   - Keep under 150 lines for token efficiency

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Generate tasks for core stax-xml package (zero dependencies)
- Generate tasks for converter package schema system
- Generate tasks for inter-package integration
- Generate tasks for monorepo tooling setup
- Each package → dedicated test tasks
- Cross-package integration test tasks

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Core types → Core parser → Converter schemas → Integration
- Mark [P] for parallel execution (separate packages)

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No violations identified - package separation actually simplifies the core library*

| Consideration | Justification | Benefit |
|---------------|---------------|---------|
| Two packages | Separate concerns: zero-dep core vs feature-rich converter | Better dependency management, cleaner architecture |
| Monorepo | Shared development workflow while maintaining package boundaries | Easier development, consistent tooling |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v2.0.0 - See `/memory/constitution.md`*
