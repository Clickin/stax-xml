# O(n) Optimization Plan for XmlParsingStateMachine

## Problem Analysis

### Current O(n²) Bottleneck

**Location**: `XmlParsingStateMachine.ts:131-150`

```typescript
for (const activation of this.activeSchemas) {  // ← Loop 1: All active schemas
  const isArraySchema = this.getSchemaType(activation.schema) === 'XmlArraySchema';
  const matches = this.matchesInContext(event, activation);
  const shouldActivate = isArraySchema
    ? matches  // ← Arrays activate on EVERY match
    : (activation.depth === -1 && matches);

  if (shouldActivate) {
    activation.depth = this.currentDepth;
    this.onSchemaActivatedSync(activation, event);  // ← Creates new activation
  }
}
```

**Performance Impact**:
- For XPath `//node` matching 111,110 nodes:
  - Each `<node>` START_ELEMENT triggers the loop
  - Each iteration checks all activeSchemas
  - Array schemas keep getting added to activeSchemas
  - Result: **O(n²)** where n = number of matching elements

**Measured Performance**:
- 120 nodes: 17ms
- 780 nodes: 92ms
- 111,110 nodes: **30+ seconds timeout**

---

## Root Cause

### Issue 1: Unbounded activeSchemas Growth
When an array schema matches multiple times:
1. First `<node>`: 1 schema in activeSchemas
2. Second `<node>`: 2 schemas in activeSchemas
3. Nth `<node>`: N schemas in activeSchemas

### Issue 2: Redundant Re-activation
Array schemas are re-activated for each match, even though they're already active and collecting items.

### Issue 3: Linear Scan on Every Event
Every START_ELEMENT event scans ALL activeSchemas, regardless of whether they can match at the current depth.

---

## Optimization Strategy

### Goal: Achieve O(n) Performance
Where n = total number of XML elements (streaming, single-pass)

### Key Insight
**Array schemas don't need multiple activations** - they need:
1. **One activation** when first matched
2. **Item creation** for each subsequent match (while still active)
3. **Deactivation** when the array's scope ends

---

## Proposed Solution

### Option 1: Array Item Mode (Recommended)

**Change array activation logic:**

```typescript
// Current (O(n²)):
const shouldActivate = isArraySchema
  ? matches  // Activates every time
  : (activation.depth === -1 && matches);

// Proposed (O(n)):
const shouldActivate = isArraySchema
  ? (activation.depth === -1 && matches)  // Activate once, like others
  : (activation.depth === -1 && matches);

// Then, for already-active array schemas:
const isActiveArrayMatch = isArraySchema
  && activation.depth !== -1  // Already active
  && matches;  // Matches again

if (isActiveArrayMatch) {
  // Create new item WITHOUT activating again
  this.createArrayItem(activation, event);
}
```

**Benefits**:
- activeSchemas size stays constant (or grows linearly with nesting depth, not with matches)
- Each START_ELEMENT still O(activeSchemas.length), but activeSchemas.length = O(nesting_depth)
- Total complexity: O(n × nesting_depth) = O(n) for reasonable nesting depths

**Implementation Details**:
1. Extract item creation logic from `onSchemaActivatedSync` to new `createArrayItem()` method
2. Modify activation condition for arrays to `activation.depth === -1 && matches`
3. Add separate handling for `isActiveArrayMatch` to create items
4. Keep deactivation logic unchanged (arrays deactivate when their element closes)

---

### Option 2: Depth-Indexed Schema Lookup

**Use a depth-indexed data structure instead of flat activeSchemas array:**

```typescript
// Current:
private activeSchemas: SchemaActivation[] = [];

// Proposed:
private schemasByDepth: Map<number, SchemaActivation[]> = new Map();
private globalSchemas: SchemaActivation[] = [];  // For descendant paths like //node
```

**Matching logic:**
```typescript
// Only check schemas relevant to current depth
const relevantSchemas = [
  ...(this.schemasByDepth.get(this.currentDepth) || []),
  ...this.globalSchemas.filter(s => s.isDescendant)
];

for (const activation of relevantSchemas) {
  // ... matching logic
}
```

**Benefits**:
- Reduces the number of schemas checked per event
- Especially effective for deep structures with many absolute/relative paths

**Drawbacks**:
- More complex bookkeeping
- Need to classify schemas as depth-specific vs global
- May not help much for `//node` patterns (all nodes are global)

---

### Option 3: XPath Pre-filtering

**Optimize XPath matching with early rejection:**

```typescript
// Add to XPathMatcher:
canMatchAtDepth(depth: number): boolean {
  // For /root/item, only matches at depth 2
  // For //item, matches at any depth
  // For ./item, matches at current context + 1

  if (this.compiled.isAbsolute && !this.compiled.isDescendant) {
    return depth === this.compiled.segments.length;
  }
  return true;  // Descendant/relative can match anywhere
}

// Use in main loop:
for (const activation of this.activeSchemas) {
  if (!activation.matcher.canMatchAtDepth(this.currentDepth)) {
    continue;  // Skip impossible matches
  }
  // ... rest of matching logic
}
```

**Benefits**:
- Reduces wasted matching attempts
- Complements Option 1 or 2

---

## Recommended Implementation Plan

### Phase 1: Option 1 (Array Item Mode) - **Highest Impact**
1. Refactor `onSchemaActivatedSync` to extract array item creation
2. Modify array activation condition: `activation.depth === -1 && matches`
3. Add `createArrayItem()` for already-active array matches
4. Test with wide-deep structure (111,110 nodes)
5. Verify all existing tests still pass

**Expected Result**: O(n²) → O(n × nesting_depth) ≈ O(n)

### Phase 2: Option 3 (XPath Pre-filtering) - **Additional Optimization**
1. Add `canMatchAtDepth()` to XPathMatcher
2. Implement depth-based early rejection
3. Benchmark improvement

**Expected Result**: Further constant-factor speedup

### Phase 3: Option 2 (Depth-Indexed Lookup) - **If Needed**
- Only if Phase 1+2 don't achieve desired performance
- More invasive change, higher maintenance cost

---

## Success Criteria

### Performance Targets
- **111,110 nodes** (wide-deep test): < 1 second
- **Linear scaling**: 10x nodes = ~10x time
- **Memory**: Constant or O(depth), not O(n)

### Test Coverage
- All existing converter tests must pass
- Wide-deep structure test must complete
- Performance benchmark test must show linear scaling

---

## Migration Notes

### Breaking Changes
- None (internal optimization only)

### Backward Compatibility
- All existing XPath patterns work unchanged
- Parsed output is identical
- Only performance characteristics change

---

## Related Issues

### Other Performance Bottlenecks to Address Later
1. XPath `last()` predicate (currently unsupported - returns false)
2. Position tracking in nested arrays (may accumulate state)
3. Wildcard matching (`*`) - currently matches last instead of first

### Testing Gaps
1. Need performance benchmarks for various XML structures
2. Missing tests for very wide trees (high branching factor)
3. No stress tests for deeply nested arrays-of-arrays

---

## References

- **Current Code**: `packages/stax-xml/src/converter/XmlParsingStateMachine.ts:131-150`
- **Test Case**: `packages/stax-xml/test/converter/deep-nesting.test.ts:371-408`
- **XPath Matcher**: `packages/stax-xml/src/converter/XPathEngine.ts:268-279`
- **Array Schema**: `packages/stax-xml/src/converter/XmlArraySchema.ts`
