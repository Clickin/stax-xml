# Test Coverage Requirements (Contracts)

**Feature**: Converter Module Test Coverage to 95%+
**Date**: 2025-10-03

This document specifies test contracts for modules requiring coverage enhancement.

## Contract 1: XmlOptionalSchema

**Current**: 57.14% | **Target**: 95%+ | **Priority**: 2
**Uncovered Lines**: 57, 65-66, 75-79

### Required Test Scenarios

**Parse Methods - Sync** (FR-001):
- test_parse_with_undefined_input() - Coverage: Line 57
- test_parse_with_null_input() - Coverage: Line 57
- test_parse_with_valid_value() - Coverage: Lines 58-60
- test_parse_when_inner_schema_throws() - Coverage: Error path

**Parse Methods - Async** (FR-002):
- test_parseAsync_with_undefined_input() - Coverage: Line 65
- test_parseAsync_with_null_input() - Coverage: Line 65
- test_parseAsync_when_inner_schema_throws_async() - Coverage: Lines 65-66

**ParseText Method** (FR-003):
- test_parseText_with_undefined_schema() - Coverage: Line 75
- test_parseText_when_inner_parseText_throws() - Coverage: Lines 75-76
- test_parseText_with_empty_string() - Coverage: Lines 75-79

**Write Methods** (FR-004):
- test_write_with_undefined_value() - Coverage: Write undefined path
- test_write_with_null_value() - Coverage: Write null path
- test_writeAsync_with_valid_value() - Coverage: Async write path

**Edge Cases**:
- test_nested_optional_schemas() - Complex composition
- test_optional_with_transform() - Transform integration

**Total**: 15-18 tests

---

## Contract 2: XmlParserInternal

**Current**: 43.69% | **Target**: 95%+ | **Priority**: 1 (HIGHEST)
**Uncovered Lines**: 56-118, 142-212, many helpers

### Required Test Scenarios

**String Parsing** (FR-005):
- test_parseString_without_xpath() - Coverage: Lines 56-70
- test_parseString_with_xpath() - Coverage: Lines 71-85
- test_parseString_with_empty_xml() - Coverage: Empty handling
- test_parseString_with_whitespace_only() - Coverage: Whitespace
- test_parseString_with_malformed_xml() - Coverage: Error path

**String Parsing Async** (FR-006):
- test_parseStringAsync_without_xpath() - Coverage: Lines 90-105
- test_parseStringAsync_with_xpath() - Coverage: Lines 106-118

**Object Parsing** (FR-007):
- test_parseObject_with_simple_shape() - Coverage: Lines 142-160
- test_parseObject_with_nested_object_no_xpath() - Coverage: Lines 161-180
- test_parseObject_with_array_no_xpath() - Coverage: Array fields
- test_parseObject_with_mixed_schemas() - Coverage: Lines 181-200
- test_parseObjectAsync_variants() - Coverage: Async object parsing

**Array Parsing** (FR-008):
- test_parseArray_with_simple_elements() - Coverage: Array logic
- test_parseArray_with_complex_elements() - Coverage: Complex elements
- test_parseArray_without_xpath_throws() - Coverage: Validation

**Position-Based Parsing** (FR-011):
- test_parseObjectFromPositionSync() - Coverage: Position object parsing
- test_parseObjectFromPosition_async() - Coverage: Async position
- test_parseArrayFromPositionSync() - Coverage: Position array parsing
- test_parseArrayFromPosition_async() - Coverage: Async array position

**Helper Methods** (FR-009 - tested via public API):
- test_extractXPath_with_various_schemas() - Via parse methods
- test_unwrapSchema_with_optional_and_transform() - Via parse methods
- test_getAllTransforms_with_chain() - Via parse methods
- test_extractValueFromCollector_all_types() - Via parse methods
- test_createCollectorForSchema_all_types() - Via parse methods

**Total**: 40-50 tests

---

## Contract 3: XmlStringSchema

**Current**: 54.05% | **Target**: 95%+ | **Priority**: 3
**Uncovered Lines**: 38-52, 55-77, 80-102

### Required Test Scenarios

**ParseFromPosition** (FR-012):
- test_parseFromPosition_with_sync_iterator() - Coverage: Lines 38-45
- test_parseFromPosition_with_async_iterator() - Coverage: Lines 46-52
- test_parseFromPosition_with_nested_elements() - Coverage: Nesting
- test_parseFromPosition_with_mixed_content() - Coverage: Mixed content

**XPath Validation** (FR-013):
- test_xpath_with_empty_string_throws() - Coverage: Validation
- test_xpath_with_valid_path() - Coverage: XPath setter

**Write Operations** (FR-014):
- test_write_with_root_element() - Coverage: Root write
- test_write_with_element_config() - Coverage: Element config
- test_writeAsync() - Coverage: Async write

**WriteContent** (FR-015):
- test_writeContent_with_cdata_config() - Coverage: CDATA
- test_writeContent_with_special_chars() - Coverage: XML escaping

**Text Collection** (FR-016):
- test_collectTextSync_with_nested_depth() - Coverage: Nested collection
- test_collectTextAsync_with_nested_depth() - Coverage: Async collection
- test_collectText_with_cdata() - Coverage: CDATA collection

**Total**: 20-25 tests

---

## Contract 4: XmlArraySchema

**Current**: 64.55% | **Target**: 95%+ | **Priority**: 4
**Uncovered Lines**: 39-71

### Required Test Scenarios

**ParseFromPosition**:
- test_parseFromPosition_sync() - Coverage: Lines 39-50
- test_parseFromPosition_async() - Coverage: Lines 51-65
- test_parseFromPosition_with_nested_arrays() - Coverage: Nesting
- test_parseFromPosition_with_complex_element_schema() - Coverage: Complex elements

**ParseText**:
- test_parseText_returns_empty_array() - Coverage: ParseText impl

**Write Operations**:
- test_write_empty_array() - Coverage: Empty write
- test_write_with_multiple_items() - Coverage: Multiple items
- test_write_with_root_element() - Coverage: Root wrapping
- test_writeAsync() - Coverage: Async write

**Edge Cases**:
- test_array_without_xpath_throws() - Coverage: Validation
- test_array_with_optional_elements() - Coverage: Optional elements

**Total**: 15-20 tests

---

## Summary

**Total Estimated Tests**: 90-113 new tests across 4 modules

**Priority Order**:
1. XmlParserInternal (40-50 tests) - Core engine
2. XmlOptionalSchema (15-18 tests)
3. XmlStringSchema (20-25 tests)
4. XmlArraySchema (15-20 tests)

**Success Criteria**:
- All modules >= 95% coverage
- All tests deterministic (consistent pass/fail)
- Test suite < 30s execution
- No breaking changes

---
*Contracts map to FR-001 through FR-020 in spec.md*
