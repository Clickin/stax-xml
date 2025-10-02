# Next Tasks - State Machine Fixes

**Priority**: HIGH → MEDIUM → LOW
**Estimated Total Time**: 4-6 hours

---

## 🔴 HIGH PRIORITY - Critical Fixes

### Task 1: Fix Transform Application (2-3 hours)

**Problem**: Transform functions are not being applied to parsed objects.

**Root Cause Analysis**:
1. State Machine uses `extractObjectFromCollector()` which does simple value extraction
2. `XmlParserInternal.extractValueFromCollector()` has transform logic but isn't used by State Machine
3. Transform chain needs to be applied AFTER object is built from collectors

**Implementation Plan**:

#### Step 1: Analyze Transform Flow
```bash
# Check how transforms are stored
grep -n "getAllTransforms\|transformFn" packages/stax-xml/src/converter/XmlParserInternal.ts

# Check current extraction logic
grep -n "extractObjectFromCollector\|extractValueFromCollector" \
  packages/stax-xml/src/converter/XmlParsingStateMachine.ts
```

#### Step 2: Update State Machine Extraction

**File**: `packages/stax-xml/src/converter/XmlParsingStateMachine.ts`

**Location**: Lines 648-664 (`extractObjectFromCollector`)

**Change**:
```typescript
// BEFORE (current)
private extractObjectFromCollector(
  collector: ObjectCollector,
  schema: any
): any {
  const result: any = {};
  const unwrappedSchema = this.unwrapSchema(schema);
  const shape = (unwrappedSchema as any).shape;

  for (const [fieldName, fieldCollector] of collector.fields) {
    const fieldSchema = shape[fieldName];
    if (fieldSchema) {
      result[fieldName] = this.extractSimpleValue(fieldCollector);
    }
  }

  return result;
}

// AFTER (with transforms)
private extractObjectFromCollector(
  collector: ObjectCollector,
  schema: any
): any {
  let result: any = {};
  const unwrappedSchema = this.unwrapSchema(schema);
  const shape = (unwrappedSchema as any).shape;

  // 1. Extract field values from collectors
  for (const [fieldName, fieldCollector] of collector.fields) {
    const fieldSchema = shape[fieldName];
    if (fieldSchema) {
      // Recursively extract, applying field-level transforms
      result[fieldName] = this.extractValueWithTransforms(fieldCollector, fieldSchema);
    }
  }

  // 2. Apply object-level transforms
  const transforms = this.getAllTransforms(schema);
  for (const transformFn of transforms) {
    result = transformFn(result);
  }

  return result;
}
```

#### Step 3: Add Transform Helper Methods

**Add to State Machine**:
```typescript
/**
 * Get all transform functions from schema chain
 */
private getAllTransforms(schema: any): Array<(value: any) => any> {
  const transforms: Array<(value: any) => any> = [];
  let current = schema;

  while (current) {
    const typeName = current?.constructor?.name || '';
    if (typeName === 'XmlTransformSchema') {
      if (current.transformFn) {
        transforms.unshift(current.transformFn); // Prepend for correct order
      }
      current = current.schema;
    } else if (typeName === 'XmlOptionalSchema') {
      current = current.schema;
    } else {
      break;
    }
  }

  return transforms;
}

/**
 * Extract value with field-level transforms
 */
private extractValueWithTransforms(collector: Collector<any>, schema: any): any {
  let value = this.extractSimpleValue(collector);

  // Apply transforms for this field
  const transforms = this.getAllTransforms(schema);
  for (const transformFn of transforms) {
    value = transformFn(value);
  }

  return value;
}
```

#### Step 4: Update Array Item Extraction

**File**: `packages/stax-xml/src/converter/XmlParsingStateMachine.ts`

**Location**: Lines 485-524 (`onSchemaDeactivatedSync` - XmlArraySchema case)

**Change**:
```typescript
// Line 500-503
const itemObject = this.extractObjectFromCollector(
  arrayCollector.currentItem,
  elementSchema
);
// ↑ This already calls the updated method, so transforms will be applied!
```

#### Step 5: Test

```bash
# Build
pnpm --filter stax-xml build

# Test transform application
node test-option-a.js

# Expected output should now include:
# {
#   ...
#   priceInfo: "599.99 USD",           // ← NEW!
#   localizedName: "Smartphone (en)"   // ← NEW!
# }

# Run transform tests
pnpm --filter stax-xml test test/converter/transform.test.ts
```

**Success Criteria**:
- ✅ test-option-a.js shows `priceInfo` and `localizedName` fields
- ✅ All transform tests (24/24) still pass
- ✅ No regression in basic tests (25/25)

---

### Task 2: Fix Memory Leak (1-2 hours)

**Problem**: State Machine accumulates schemas without cleanup, causing heap overflow.

**Root Cause**: Schemas registered during array iteration are never removed from `activeSchemas`.

**Implementation Plan**:

#### Step 1: Understand the Leak

```typescript
// When array element is processed:
onSchemaActivatedSync() {
  // For each array item, registers 6+ child schemas
  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    this.registerSchema(...); // ← Adds to activeSchemas array
  }
}

// Problem: These schemas are NEVER removed!
// After 1000 items → 6000+ schemas in memory
```

#### Step 2: Implement Schema Cleanup

**File**: `packages/stax-xml/src/converter/XmlParsingStateMachine.ts`

**Add property to SchemaActivation**:
```typescript
// Line 67-76
export interface SchemaActivation {
  schema: XmlSchemaBase<any, any>;
  xpath: string;
  matcher: XPathMatcher;
  depth: number;
  collector: Collector<any>;
  context?: MatchContext;
  fieldName?: string;
  isTemporary?: boolean;  // ← NEW: Mark dynamically registered schemas
}
```

**Update registration**:
```typescript
// Line 366-386 (in onSchemaActivatedSync, XmlArraySchema case)
const activation = this.registerSchema(
  fieldSchema,
  xpath,
  childCollector,
  itemContext,
  fieldName
);

// Mark as temporary - should be cleaned up when parent deactivates
activation.isTemporary = true;  // ← NEW
```

**Update deactivation**:
```typescript
// Line 485-524 (onSchemaDeactivatedSync, XmlArraySchema case)
case 'XmlArraySchema':
  // ... existing item extraction logic ...

  // NEW: Clean up temporary child schemas
  this.activeSchemas = this.activeSchemas.filter(a =>
    !(a.context && a.context.contextDepth === this.currentDepth && a.isTemporary)
  );

  arrayCollector.currentItem = undefined;
  break;
```

#### Step 3: Test

```bash
# Build
pnpm --filter stax-xml build

# Test with large file (should not crash)
pnpm --filter stax-xml test test/converter/large-file.test.ts \
  -t "should parse 1000 items efficiently"

# Monitor memory usage
node --expose-gc packages/stax-xml/test/converter/large-file.test.ts
```

**Success Criteria**:
- ✅ Large file test completes without OOM
- ✅ activeSchemas count stays bounded (< 50 at any time)
- ✅ No regression in other tests

---

## 🟡 MEDIUM PRIORITY - Complex Shape Fixes

### Task 3: Fix Jagged Arrays (1 hour)

**Failing Test**: `should parse jagged arrays`

**Test File**: `packages/stax-xml/test/converter/complex-shapes.test.ts`

**Problem**: Nested arrays with varying depths not parsing correctly.

**Investigation Steps**:

```bash
# Run the specific test with debug
pnpm --filter stax-xml test test/converter/complex-shapes.test.ts \
  -t "should parse jagged arrays"

# Enable debug in State Machine
# Set isDebug = true on lines 129, 160 in XmlParsingStateMachine.ts
```

**Expected Pattern**:
```xml
<data>
  <level1>
    <item>A</item>
    <item>B</item>
  </level1>
  <level1>
    <item>C</item>
  </level1>
</data>
```

**Likely Issue**: Nested array (array of arrays) not properly handled in State Machine.

**Check**:
- Line 378-405: XmlArraySchema activation - nested array case
- Verify `ArrayCollector<any>` is correctly handled
- Ensure nested array collector is added to parent items

**Fix Location**: `onSchemaActivatedSync()` - XmlArraySchema → XmlArraySchema case

---

### Task 4: Fix Nested Data Structures (1 hour)

**Failing Test**: `should parse nested data structures`

**Problem**: Complex object-in-array-in-object structures.

**Pattern**:
```xml
<catalog>
  <categories>
    <category>
      <products>
        <product>
          <name>Item 1</name>
        </product>
      </products>
    </category>
  </categories>
</catalog>
```

**Investigation**:
1. Check if context chain is properly maintained
2. Verify relative XPath resolution at deep nesting levels
3. Test `matchesInContext()` with 4+ depth levels

---

### Task 5: Fix Recursive Structures (30 min)

**Failing Test**: `should handle menu structures`

**Problem**: Self-referential/recursive schemas not supported.

**Note**: This might be a limitation of the current architecture. May need to document as "not supported" or implement special handling.

---

## 🟢 LOW PRIORITY - Nice to Have

### Task 6: Optimize Performance (30 min)

**Goal**: Reduce time for "should parse 1000 items efficiently" test.

**Current**: ~6684ms
**Target**: <1000ms

**Strategies**:
1. Profile State Machine overhead
2. Consider object pooling for collectors
3. Optimize `matchesInContext()` - most called method
4. Cache unwrapped schemas

---

### Task 7: Clean Up Debug Code (15 min)

**Files to update**:
- Remove or consolidate debug logging
- Ensure `isDebug = false` in all production code
- Consider environment variable for debug mode

---

## 📋 Testing Checklist

After each task, run this full test sequence:

```bash
# Quick smoke test
node test-option-a.js

# Core functionality
pnpm --filter stax-xml test test/converter/basic.test.ts
pnpm --filter stax-xml test test/converter/transform.test.ts

# Complex cases
pnpm --filter stax-xml test test/converter/complex-shapes.test.ts

# Performance
pnpm --filter stax-xml test test/converter/large-file.test.ts

# Full suite (if time permits)
pnpm --filter stax-xml test test/converter
```

---

## 🎯 Success Definition

**Minimum Success** (Required):
- ✅ Transforms are applied correctly
- ✅ No memory leaks on large files
- ✅ All basic tests pass (25/25)
- ✅ All transform tests pass (24/24)

**Full Success** (Ideal):
- ✅ All above +
- ✅ Complex shapes: 12/14 tests pass (allow 2 edge cases)
- ✅ Large file tests complete without crash

---

## 📝 Documentation Updates

After completing fixes, update:

1. **CURRENT_STATUS.md** - Update test results
2. **IMPLEMENTATION_STATUS.md** - Mark tasks complete
3. **HANDOFF_SUMMARY.md** - Final state for next agent

---

## 🆘 If Stuck

### Issue: Can't find where transforms are stored

**Answer**: Look at `XmlTransformSchema` class definition:
```bash
grep -n "class XmlTransformSchema" packages/stax-xml/src/converter/*.ts
```

### Issue: Tests still failing after transform fix

**Debug Strategy**:
```typescript
// Add logging in extractObjectFromCollector
console.log('Schema type:', schema.constructor.name);
console.log('Has transformFn?', 'transformFn' in schema);
console.log('Result before transform:', result);
console.log('Result after transform:', transformedResult);
```

### Issue: Memory leak persists

**Check**:
```typescript
// Add counter in processEventSync
console.log('Active schemas:', this.activeSchemas.length);
// Should not grow unbounded!
```

---

## 📞 Handoff Protocol

When passing to next agent, ensure:
1. ✅ All code changes are committed
2. ✅ Build succeeds
3. ✅ Test results documented
4. ✅ Update CURRENT_STATUS.md with findings
5. ✅ Create new summary in directions folder
