# Data Model: Test Coverage Entities

**Feature**: Converter Module Test Coverage Enhancement
**Date**: 2025-10-03

## Entity Definitions

### 1. Test Case

**Purpose**: Represents a single test scenario validating specific functionality

**Fields**:
- `name` (string): Descriptive test name following pattern "should [behavior] when [condition]"
- `scenario` (string): Test category (e.g., "edge case", "error handling", "async variant")
- `module_under_test` (string): Target module (XmlOptionalSchema, XmlParserInternal, etc.)
- `input_xml` (string): XML document fed to parser
- `input_schema` (SchemaDefinition): Schema definition using `x.*()` API
- `expected_output` (any | Error): Expected parse result or error
- `coverage_target` (line_range): Specific lines this test aims to cover
- `execution_time_ms` (number): Test execution duration

**Validation Rules**:
- `name` must be descriptive and follow project conventions
- `input_xml` must be well-formed or intentionally malformed for error tests
- `execution_time_ms` must be < 1000ms (individual test timeout)
- Must follow arrange-act-assert structure

**Relationships**:
- Belongs to: Test Suite (1:N)
- Targets: Coverage Gap (N:M)

**State Transitions**:
```
Created → Passing → Maintained
Created → Failing → Fixed → Passing
```

**Example**:
```typescript
{
  name: "should parse optional string when value present",
  scenario: "happy path",
  module_under_test: "XmlOptionalSchema",
  input_xml: "<root><value>test</value></root>",
  input_schema: x.object({
    value: x.string().optional().xpath('//value')
  }),
  expected_output: { value: "test" },
  coverage_target: "57-60",
  execution_time_ms: 5
}
```

### 2. Coverage Gap

**Purpose**: Tracks uncovered code requiring test cases

**Fields**:
- `module_name` (string): Name of module (e.g., "XmlOptionalSchema")
- `file_path` (string): Absolute path to source file
- `current_percentage` (number): Current coverage % (0-100)
- `target_percentage` (number): Target coverage % (95-100)
- `uncovered_lines` (number[]): Array of uncovered line numbers
- `uncovered_branches` (string[]): Uncovered branch conditions
- `priority` (1-4): Implementation priority (1=highest)
- `estimated_tests_needed` (number): Estimated test cases to close gap

**Validation Rules**:
- `current_percentage` < `target_percentage`
- `target_percentage` >= 95
- `priority` in range 1-4
- `uncovered_lines` derived from v8 coverage report

**Relationships**:
- Has many: Test Cases (N:M - multiple tests can target same gap)
- Belongs to: Module (N:1)

**State Transitions**:
```
Identified → Test Cases Created → Tests Passing → Coverage Met → Closed
```

**Current Gaps**:
```typescript
[
  {
    module_name: "XmlParserInternal",
    file_path: "packages/stax-xml/src/converter/XmlParserInternal.ts",
    current_percentage: 43.69,
    target_percentage: 95,
    uncovered_lines: [56-118, 142-212, /* many more */],
    priority: 1,
    estimated_tests_needed: 45
  },
  {
    module_name: "XmlOptionalSchema",
    file_path: "packages/stax-xml/src/converter/XmlOptionalSchema.ts",
    current_percentage: 57.14,
    target_percentage: 95,
    uncovered_lines: [57, 65-66, 75-79],
    priority: 2,
    estimated_tests_needed: 18
  },
  {
    module_name: "XmlStringSchema",
    file_path: "packages/stax-xml/src/converter/XmlStringSchema.ts",
    current_percentage: 54.05,
    target_percentage: 95,
    uncovered_lines: [38-52, 55-77, 80-102],
    priority: 3,
    estimated_tests_needed: 22
  },
  {
    module_name: "XmlArraySchema",
    file_path: "packages/stax-xml/src/converter/XmlArraySchema.ts",
    current_percentage: 64.55,
    target_percentage: 95,
    uncovered_lines: [39-71],
    priority: 4,
    estimated_tests_needed: 16
  }
]
```

### 3. Test Suite

**Purpose**: Collection of related test cases in a single file

**Fields**:
- `file_path` (string): Path to test file (e.g., "packages/stax-xml/test/converter/parser-internal.test.ts")
- `module_under_test` (string): Primary module being tested
- `test_count` (number): Number of test cases in file
- `total_execution_time_ms` (number): Total suite execution time
- `coverage_contribution` (object): Lines covered by this suite
- `dependencies` (string[]): Other test files or modules required

**Validation Rules**:
- `total_execution_time_ms` < 5000ms (per-file timeout guideline)
- `test_count` >= 1
- File must follow naming pattern `*.test.ts`
- Must be in `test/converter/` directory

**Relationships**:
- Contains: Test Cases (1:N)
- Targets: Coverage Gaps (1:N)

**Example**:
```typescript
{
  file_path: "packages/stax-xml/test/converter/parser-internal.test.ts",
  module_under_test: "XmlParserInternal",
  test_count: 8, // Current, will expand to ~50
  total_execution_time_ms: 17,
  coverage_contribution: {
    XmlParserInternal: [200-215, 300-320] // Example line ranges
  },
  dependencies: ["x from converter/index.js"]
}
```

### 4. Schema Definition

**Purpose**: Declarative XML schema used in tests

**Fields**:
- `type` (string): Schema type ("string", "number", "object", "array", "optional")
- `xpath` (string | undefined): XPath expression for element selection
- `writer_config` (object | undefined): Writer configuration (element name, attributes, etc.)
- `transforms` (function[]): Transform functions applied to parsed values
- `nested_schema` (SchemaDefinition | undefined): For optional/array element schemas

**Validation Rules**:
- `type` must be valid schema type
- `xpath` required for most schemas (except position-based parsing)
- `writer_config` required for write tests

**Relationships**:
- Used by: Test Cases (N:M)

**Example**:
```typescript
{
  type: "object",
  schema_fields: {
    name: {
      type: "string",
      xpath: "//person/@name"
    },
    age: {
      type: "number",
      xpath: "//person/age",
      transforms: [parseInt]
    },
    email: {
      type: "optional",
      nested_schema: {
        type: "string",
        xpath: "//person/email"
      }
    }
  }
}
```

## Entity Relationships Diagram

```
┌─────────────────┐
│  Coverage Gap   │
│  - module_name  │
│  - current_%    │
│  - target_%     │
│  - lines        │
│  - priority     │
└────────┬────────┘
         │ 1
         │
         │ N
    ┌────▼──────┐
    │ Test Case │◄──────┐
    │ - name    │       │
    │ - scenario│       │ N
    │ - input   │       │
    │ - expected│       │
    └─────┬─────┘       │
          │ N           │
          │             │
          │ 1           │
     ┌────▼────────┐    │
     │ Test Suite  │────┘
     │ - file_path │ 1
     │ - test_count│
     │ - exec_time │
     └─────────────┘
```

## Data Flow

1. **Coverage Analysis** → Identifies Coverage Gaps
2. **Gap Prioritization** → Orders gaps by priority (1-4)
3. **Test Design** → Creates Test Cases targeting gaps
4. **Test Implementation** → Groups Test Cases into Test Suites
5. **Test Execution** → Runs Test Suites, generates coverage
6. **Gap Closure** → Coverage Gaps transition to "Met" status

## Validation Matrix

| Entity | Required Fields | Optional Fields | Constraints |
|--------|----------------|-----------------|-------------|
| Test Case | name, scenario, module, input, expected | coverage_target | exec_time < 1000ms |
| Coverage Gap | module, file_path, current_%, target_% | estimated_tests | target >= 95 |
| Test Suite | file_path, module, test_count | dependencies | total_time < 5000ms |
| Schema Definition | type | xpath, writer_config, transforms | type in allowed_types |

## Success Metrics

- **Coverage Gap Closure Rate**: (Gaps Met / Total Gaps) >= 100%
- **Test Execution Performance**: Total suite time < 30s
- **Test Determinism**: 0 flaky tests (100% consistent pass/fail)
- **Code Quality**: All tests follow existing patterns (100% compliance)

---
*Data model for test coverage enhancement feature*
*Supports Phase 2 task generation and Phase 4 implementation*
