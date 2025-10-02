# Next Steps for State Machine Completion

## Current Status (2025-10-01)

**Test Results**: 29 failed / 249 total (88.4% pass rate)
**Target**: < 10 failures (96%+ pass rate)
**Progress**: +5.7% from starting point (82.7%)

## Completed Work

✅ Phase 3: Transform/Optional full support
✅ Phase 4: Attribute selector priority handling
✅ Parent activation scoping (prevents global matching)
✅ Code cleanup (removed unused methods)

See [PHASE_3_4_COMPLETION_SUMMARY.md](./PHASE_3_4_COMPLETION_SUMMARY.md) for detailed implementation notes.

## Critical Remaining Issue: Nested Object Field Scoping

### Problem Description

When parsing arrays of objects with relative XPath selectors, fields match globally instead of within their parent scope:

```typescript
// This schema:
x.array(
  x.object({
    shelf: x.string().xpath('./@id'),
    bookCount: x.array(x.string(), './book/@id').transform(b => b.length)
  }),
  '//shelf'
)

// With this XML:
<library>
  <shelf id="A1">
    <book id="book1"/>
    <book id="book2"/>
  </shelf>
  <shelf id="B1">
    <book id="book3"/>
  </shelf>
</library>

// Expected: [
//   { shelf: 'A1', bookCount: 2 },
//   { shelf: 'B1', bookCount: 1 }
// ]
//
// Actual:
//   { shelf: undefined, bookCount: 0 }  // or incorrect values
```

### Root Cause

1. Array activates at `<shelf id="A1">` (depth 2)
2. Object fields registered with resolved XPath:
   - `./@id` → `//shelf/@id`
   - `./book/@id` → `//shelf/book/@id`
3. These XPath patterns match ALL shelves globally, not just the current parent
4. Parent activation check helps, but XPath matching still sees all matches

### Proposed Solutions

#### Solution 1: Depth-Scoped Matching (Recommended)

Enhance XPathMatcher to only match within a depth range:

```typescript
interface SchemaActivation {
  // ... existing fields
  minDepth?: number;  // Only match at or below this depth
  maxDepth?: number;  // Only match at or above this depth
}

// In onSchemaActivatedSync for array items:
const childActivation = this.registerSchema(
  fieldSchema,
  resolvedXPath,
  childCollector,
  activation,
  fieldName
);
// Set depth constraints for scoped matching
childActivation.minDepth = activation.depth;
childActivation.maxDepth = Infinity;

// In processEventSync:
if (shouldActivate) {
  // Check depth constraints
  if (activation.minDepth !== undefined && this.currentDepth < activation.minDepth) {
    continue;
  }
  if (activation.maxDepth !== undefined && this.currentDepth > activation.maxDepth) {
    continue;
  }
  // ... activate
}
```

**Pros**:
- Elegant, uses existing XPath infrastructure
- Works for arbitrarily nested structures
- Minimal code changes

**Cons**:
- Depth checking adds small overhead to hot path

**Estimated Time**: 2-3 hours
**Estimated Tests Fixed**: 10-15

#### Solution 2: Local Collection Mode

For relative XPath (starts with `./`), switch to direct child collection instead of global matching:

```typescript
// In onSchemaActivatedSync:
if (xpath.startsWith('./')) {
  // Mark this activation as "local collection mode"
  activation.localCollectionMode = true;
  activation.localPattern = xpath.slice(2); // Remove './'
}

// In processEventSync:
if (activation.localCollectionMode && activation.parentActivation) {
  // Only match if we're a direct child of the parent's depth
  if (this.currentDepth !== activation.parentActivation.depth + 1) {
    continue;
  }
  // Use simple name matching instead of XPath
  if (event.name === activation.localPattern.split('/')[0]) {
    // ... activate
  }
}
```

**Pros**:
- Very fast for simple cases
- Intuitive semantics

**Cons**:
- Doesn't work for complex relative XPath like `./section[@name='X']/item`
- Separate code path to maintain

**Estimated Time**: 3-4 hours
**Estimated Tests Fixed**: 8-10

#### Solution 3: Contextual XPath (Most Complete)

Implement a full XPath context stack:

```typescript
class XmlParsingStateMachine {
  private contextStack: Array<{
    element: string;
    depth: number;
    activation?: SchemaActivation;
  }> = [];

  // Push/pop context on START_ELEMENT/END_ELEMENT
  // When matching, provide context to XPathMatcher
}

class XPathMatcher {
  matches(event: StartElementEvent, context?: XPathContext): boolean {
    // Use context to resolve relative paths and predicates
  }
}
```

**Pros**:
- Most correct XPath semantics
- Handles all edge cases
- Future-proof

**Cons**:
- Significant refactoring required
- Higher complexity
- More code to test

**Estimated Time**: 6-8 hours
**Estimated Tests Fixed**: 15-20

### Recommendation

**Start with Solution 1 (Depth-Scoped Matching)**:
- Quick to implement
- Fixes the majority of cases
- Low risk of introducing new bugs

If tests still fail after Solution 1, consider Solution 3 for complete correctness.

## Other Remaining Test Categories

### Event Streaming (4 failures)
- Test files: `event-stream.test.ts`
- Issue: Chunked streaming not properly handled
- Action: Review streaming logic, ensure state machine can handle incomplete documents
- Estimated time: 2-3 hours

### Writer Tests (3 failures)
- Test files: `writer.test.ts`
- Issue: XML writing logic (unrelated to parser)
- Action: Separate investigation
- Estimated time: 1-2 hours

### Edge Cases (7 failures)
- Recursive structures
- Position predicates in deep nesting
- Wildcard XPath matching
- Large file handling
- Estimated time: 3-4 hours

## Implementation Plan

### Week 1: Core Scoping Fix
1. Implement Solution 1 (Depth-Scoped Matching)
2. Run full test suite
3. Debug any regressions

**Expected Result**: 15-20 failures remaining

### Week 2: Edge Cases
1. Fix streaming tests
2. Fix edge case tests (recursion, wildcards, etc.)
3. Fix writer tests (separate from parser)

**Expected Result**: < 10 failures remaining

### Week 3: Polish
1. Final bug fixes
2. Performance optimization
3. Documentation
4. Code review

**Expected Result**: 96%+ pass rate achieved

## Testing Strategy

### Regression Prevention
```bash
# Before making changes
pnpm --filter stax-xml test test/converter 2>&1 | tee before.log

# After making changes
pnpm --filter stax-xml test test/converter 2>&1 | tee after.log

# Compare
diff <(grep "Test Files" before.log) <(grep "Test Files" after.log)
```

### Focused Testing
```bash
# Test specific category
pnpm --filter stax-xml test test/converter/xpath-mapping.test.ts

# Test single case
pnpm --filter stax-xml test test/converter/xpath-mapping.test.ts -t "should combine attributes"

# Watch mode for rapid iteration
pnpm --filter stax-xml test test/converter/xpath-mapping.test.ts --watch
```

### Debug Logging
Enable debug logging in `XmlParsingStateMachine.ts`:
```typescript
const isDebug = true; // Change to true
```

This will show:
- When schemas activate/deactivate
- Current depth
- Active schema count
- Matching events

## Success Criteria

- [ ] Test pass rate ≥ 96% (< 10 failures)
- [ ] No performance regression (< 10% slower)
- [ ] All nested object tests pass
- [ ] All streaming tests pass
- [ ] Code coverage maintained
- [ ] Documentation updated

## Files to Modify

### Primary Focus
- `packages/stax-xml/src/converter/XmlParsingStateMachine.ts` - Add depth constraints
- `packages/stax-xml/src/converter/XmlParserInternal.ts` - Minor adjustments if needed

### Testing
- `packages/stax-xml/test/converter/xpath-mapping.test.ts` - Verify nested objects
- `packages/stax-xml/test/converter/event-stream.test.ts` - Verify streaming

## References

- [TASK_HANDOFF_STATE_MACHINE.md](./TASK_HANDOFF_STATE_MACHINE.md) - Original architecture document
- [PHASE_3_4_COMPLETION_SUMMARY.md](./PHASE_3_4_COMPLETION_SUMMARY.md) - What was completed
- `packages/stax-xml/src/converter/` - Source code location

## Contact

If you have questions about the implementation, check:
1. Debug logs (set `isDebug = true` in state machine)
2. Test output for specific failure messages
3. Git history for implementation context
