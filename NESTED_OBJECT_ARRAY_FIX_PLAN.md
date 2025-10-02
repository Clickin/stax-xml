# Nested Object Array Parsing - Complete Fix Plan

## Problem Statement

Nested object arrays with relative XPath are not being parsed correctly. Test failure example:

```typescript
const itemSchema = x.object({
  sku: x.string().xpath('./@sku'),
  name: x.string().xpath('./name'),
  price: x.number().xpath('./price'),
});

const schema = x.object({
  items: x.array(itemSchema, '//item'),
});

// Input:
// <inventory>
//   <item sku="ABC123"><name>Phone</name><price>599.99</price></item>
// </inventory>

// Expected: { items: [{ sku: 'ABC123', name: 'Phone', price: 599.99 }] }
// Actual: { items: ["Phone599.99"] }  ← WRONG!
```

## Root Cause

When parsing arrays of objects, the system takes two paths:

1. **State Machine Path** (works correctly):
   - Array element activates
   - Creates object collector
   - Registers object fields with relative XPath
   - Populates collectors correctly

2. **Position-Based Path** (breaks the flow):
   - `parseArrayFromPosition()` calls `elementSchema._parseFromPosition()`
   - `XmlObjectSchema._parseFromPosition()` calls `parseObjectFromPosition()`
   - `parseObjectFromPosition()` creates a **NEW State Machine**
   - New State Machine has no connection to parent's context
   - Results extracted incorrectly

## Current State (After Attempted Fixes)

### What Works
- Basic object parsing ✅
- Basic array parsing ✅
- Simple nested structures ✅
- Context-based XPath matching logic ✅ (implemented but not fully integrated)

### What Doesn't Work
- Arrays of objects with relative XPath ❌
- Nested arrays within objects ❌
- Multi-level nesting ❌

### Files Modified
- `XmlParsingStateMachine.ts` - Added MatchContext, context-based matching
- `XmlParserInternal.ts` - Refactored parseObjectFromPosition to use State Machine
- `XmlObjectSchema.ts` - Changed parameter from parentXPath to parentActivation/context

## The Solution: Unified State Machine Architecture

### Core Principle
**One State Machine per parse operation, not one per nested structure.**

### Key Changes Required

#### 1. Remove Duplicate State Machine Creation

**File**: `packages/stax-xml/src/converter/XmlParserInternal.ts`

**Current (WRONG)**:
```typescript
async parseObjectFromPosition<T>(
  iterator: AsyncIterator<AnyXmlEvent>,
  startEvent: StartElementEvent,
  startDepth: number,
  shape: Record<string, any>,
  schemaOptions: { xpath?: string },
  parentActivation?: SchemaActivation
): Promise<T> {
  // Creates NEW State Machine - PROBLEM!
  const stateMachine = new XmlParsingStateMachine(this.options);
  const rootCollector: ObjectCollector = { type: 'object', fields: new Map() };

  // ...
}
```

**Should Be**:
```typescript
async parseObjectFromPosition<T>(
  iterator: AsyncIterator<AnyXmlEvent>,
  startEvent: StartElementEvent,
  startDepth: number,
  shape: Record<string, any>,
  schemaOptions: { xpath?: string },
  stateMachine: XmlParsingStateMachine,  // RECEIVE State Machine
  parentContext?: MatchContext  // Context for relative matching
): Promise<T> {
  // Use provided State Machine - no new instance!
  // Collectors already registered by parent activation
  // Just process events and extract results
}
```

#### 2. Thread State Machine Through Call Chain

**Files to Update**:
- `XmlParserInternal.ts` - All parseArray* methods
- `XmlObjectSchema.ts` - _parseFromPosition signature
- `XmlArraySchema.ts` - _parseFromPosition signature

**Pattern**:
```typescript
// In XmlObjectSchema._parseFromPosition
_parseFromPosition(
  iterator: Iterator<AnyXmlEvent> | AsyncIterator<AnyXmlEvent>,
  startEvent: StartElementEvent,
  startDepth: number,
  options?: ParseOptions,
  stateMachine?: XmlParsingStateMachine,  // ADD THIS
  parentContext?: MatchContext  // ADD THIS
): InferObjectOutput<T> | Promise<InferObjectOutput<T>> {
  const parser = new XmlParserInternal(options);

  // Pass State Machine through
  if (isAsync(iterator)) {
    return parser.parseObjectFromPosition(
      iterator,
      startEvent,
      startDepth,
      this.shape,
      this.options,
      stateMachine,  // PASS IT
      parentContext
    );
  } else {
    return parser.parseObjectFromPositionSync(
      iterator,
      startEvent,
      startDepth,
      this.shape,
      this.options,
      stateMachine,  // PASS IT
      parentContext
    );
  }
}
```

#### 3. Extract Results from Existing Collectors

**File**: `packages/stax-xml/src/converter/XmlParserInternal.ts`

**In parseArrayFromPosition**:
```typescript
async parseArrayFromPosition<T>(
  iterator: AsyncIterator<AnyXmlEvent>,
  startEvent: StartElementEvent,
  startDepth: number,
  elementSchema: any,
  xpath?: string,
  stateMachine?: XmlParsingStateMachine  // ADD THIS
): Promise<T[]> {
  // Create State Machine if not provided (root level)
  const sm = stateMachine || new XmlParsingStateMachine(this.options);

  // Register array schema
  const arrayCollector: ArrayCollector<T> = { type: 'array', items: [] };
  const activation = sm.registerSchema(
    { constructor: { name: 'XmlArraySchema' }, element: elementSchema, xpath } as any,
    xpath!,
    arrayCollector
  );

  // Process events through State Machine
  await sm.processEventAsync(startEvent);

  let currentDepth = startDepth;
  let iterResult = await iterator.next();

  while (!iterResult.done && currentDepth >= startDepth) {
    const event = iterResult.value;

    // Let State Machine handle everything!
    await sm.processEventAsync(event);

    if (isStartElement(event)) {
      currentDepth++;
    } else if (isEndElement(event)) {
      currentDepth--;
      if (currentDepth < startDepth) break;
    }

    iterResult = await iterator.next();
  }

  // Extract results from State Machine's collectors
  return this.extractValueFromCollector(arrayCollector, { element: elementSchema });
}
```

#### 4. Update Top-Level Parse Methods

**File**: `packages/stax-xml/src/converter/XmlParserInternal.ts`

**parseObjectAsync** should create State Machine and pass it down:
```typescript
async parseObjectAsync<T>(
  input: ParseInput,
  shape: Record<string, any>,
  schemaOptions: { xpath?: string }
): Promise<T> {
  const parser = this.createParser(input);
  const stateMachine = new XmlParsingStateMachine(this.options);
  const rootCollector: ObjectCollector = { type: 'object', fields: new Map() };

  // Register root object with no parent context
  const rootSchema = { constructor: { name: 'XmlObjectSchema' }, shape } as any;
  stateMachine.registerSchema(
    rootSchema,
    schemaOptions.xpath || '/',
    rootCollector,
    undefined  // No parent context for root
  );

  // Process all events through State Machine
  for await (const event of parser) {
    await stateMachine.processEventAsync(event);
  }

  // Extract final result
  return this.extractValueFromCollector(rootCollector, rootSchema) as T;
}
```

## Implementation Steps

### Phase 1: Add State Machine Parameter (Non-Breaking)

1. ✅ Add optional `stateMachine` parameter to `_parseFromPosition` methods
2. ✅ Add optional `stateMachine` parameter to `parseObjectFromPosition*` methods
3. ✅ Add optional `stateMachine` parameter to `parseArrayFromPosition*` methods
4. ✅ Keep backward compatibility by creating new instance if not provided

### Phase 2: Thread State Machine Through (Breaking for Internal APIs)

5. Update `parseArrayFromPosition` to create/use State Machine
6. Update `parseArrayFromPositionSync` similarly
7. Update all array parsing call sites to pass State Machine
8. Update object parsing call sites

### Phase 3: Remove Fallback Logic

9. Make `stateMachine` parameter required (not optional)
10. Remove code that creates new instances
11. Add assertions to ensure State Machine is provided

### Phase 4: Testing & Validation

12. Run full test suite
13. Verify nested object arrays work
14. Verify jagged arrays work
15. Verify multi-level nesting works
16. Check performance (should be better - fewer State Machine instances)

## Test Cases to Verify

### Test 1: Simple Nested Object Array
```typescript
const schema = x.object({
  items: x.array(
    x.object({
      name: x.string().xpath('./name'),
      price: x.number().xpath('./price')
    }),
    '//item'
  )
});

const xml = `
<root>
  <item><name>A</name><price>10</price></item>
  <item><name>B</name><price>20</price></item>
</root>
`;

const result = schema.parseSync(xml);
// Should get: { items: [{ name: 'A', price: 10 }, { name: 'B', price: 20 }] }
```

### Test 2: Jagged Arrays (Nested Arrays)
```typescript
const schema = x.object({
  data: x.array(
    x.array(x.number(), './number'),
    '//row'
  )
});

const xml = `
<root>
  <row><number>1</number><number>2</number></row>
  <row><number>3</number></row>
</root>
`;

const result = schema.parseSync(xml);
// Should get: { data: [[1, 2], [3]] }
```

### Test 3: Multi-Level Nesting
```typescript
const schema = x.object({
  categories: x.array(
    x.object({
      name: x.string().xpath('./name'),
      products: x.array(
        x.object({
          title: x.string().xpath('./title'),
          price: x.number().xpath('./price')
        }),
        './product'
      )
    }),
    '//category'
  )
});
```

## Files to Modify

### Critical Files (Must Change)
1. `packages/stax-xml/src/converter/XmlParserInternal.ts`
   - `parseObjectFromPosition` (async & sync versions)
   - `parseArrayFromPosition` (async & sync versions)
   - `parseObjectAsync` / `parseObject`
   - `parseArrayAsync` / `parseArray`

2. `packages/stax-xml/src/converter/XmlObjectSchema.ts`
   - `_parseFromPosition` signature

3. `packages/stax-xml/src/converter/XmlArraySchema.ts`
   - `_parseFromPosition` signature

### Supporting Files (May Need Updates)
4. `packages/stax-xml/src/converter/XmlParsingStateMachine.ts`
   - Already has MatchContext (✅ done)
   - Already has context-based matching (✅ done)
   - May need to export more helper methods

5. `packages/stax-xml/src/converter/types.ts`
   - May need to export MatchContext, SchemaActivation

## Expected Impact

### Test Results
- **Before**: 39 failed / 249 tests (84.3% pass rate)
- **After**: ~5-10 failed / 249 tests (96-98% pass rate)
- **Target**: All nested object/array tests should pass

### Performance
- **Better**: Fewer State Machine instances created
- **Better**: Less memory allocation for duplicate matchers
- **Same**: Single-level parsing unchanged

### Code Quality
- **Better**: Clearer separation of concerns
- **Better**: Single source of truth (one State Machine)
- **Better**: Easier to debug (trace through one State Machine)

## Rollback Plan

If this approach fails:

1. Git branch: `feature/unified-state-machine`
2. Keep old implementation in separate branch
3. Can revert by checking out previous commit
4. Document why it failed for future attempts

## Success Criteria

- ✅ Test: "should parse jagged arrays" passes
- ✅ Test: "should parse nested data structures" passes
- ✅ Test: "should handle complex product variants" passes
- ✅ All XPath mapping tests pass
- ✅ No performance regression
- ✅ No memory leaks

## Additional Notes

### Why This Will Work

The State Machine ALREADY does everything correctly:
1. Creates contexts when objects/arrays activate
2. Registers child fields with relative XPath
3. Matches using context-based depth calculation
4. Populates collectors in correct structure

We just need to **USE** it instead of fighting it!

### What Changed vs. Original Code

**Original Issue**: No context awareness, absolute path concatenation
**First Fix Attempt**: Added parentActivation chain, path resolution
**Second Fix Attempt**: Added MatchContext, context-based matching
**This Fix**: Actually USE the State Machine we built!

The context-based matching logic is CORRECT. We just need to stop creating duplicate State Machines.

### Debug Tips

If tests still fail after implementation:

1. Enable State Machine debug logging:
   ```typescript
   const isDebug = true; // in XmlParsingStateMachine.ts
   ```

2. Check collector structure before extraction:
   ```typescript
   console.log('Collector:', JSON.stringify(collector, (k, v) =>
     v instanceof Map ? `Map(${v.size})` : v, 2
   ));
   ```

3. Verify activation chain:
   ```typescript
   console.log('Activations:', this.activeSchemas.map(a => ({
     type: this.getSchemaType(a.schema),
     depth: a.depth,
     xpath: a.xpath,
     contextDepth: a.context?.contextDepth
   })));
   ```

## Questions to Verify Understanding

Before starting implementation, ensure you can answer:

1. Why does creating a new State Machine in `parseObjectFromPosition` break things?
2. What is the difference between `parentActivation` and `MatchContext`?
3. How does context-based matching calculate expected depth?
4. Why do we need to thread State Machine through `_parseFromPosition`?
5. What happens to the collectors after State Machine processes events?

## Ready to Implement

This document contains:
- ✅ Clear problem statement with example
- ✅ Root cause analysis
- ✅ Complete solution architecture
- ✅ Step-by-step implementation plan
- ✅ Code examples for each change
- ✅ Test cases to verify
- ✅ Success criteria
- ✅ Rollback plan
- ✅ Debug tips

Start with Phase 1, test incrementally, and verify each phase before moving to the next.

Good luck! 🚀
