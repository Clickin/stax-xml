# Option A: State Machine Integration - Implementation Plan

## Executive Summary

**Goal**: Fix nested object array parsing by integrating State Machine for XPath resolution instead of XML buffering approach.

**Current Status**: 31 failed / 249 tests (87.6% pass rate)
**Target**: < 10 failures (96%+ pass rate)
**Expected Result**: 15-20 test fixes with Option A implementation

## Problem Statement

### Root Cause Analysis

Currently, when parsing arrays of objects with relative XPath selectors (e.g., `x.array(x.object({...}), '//item')`), the following flow occurs:

1. Root object parsing starts via `parseObjectAsync`
2. Array fields trigger **XML buffering** (lines 463-482 in XmlParserInternal.ts)
3. Buffered XML is reparsed via `schema._parseAsync(xmlBuffer, this.options)` (line 589)
4. **New parser starts without parent XPath context**
5. Nested object fields with relative XPath (e.g., `./@sku`, `./name`) cannot resolve correctly

### Why Option B Failed

Option B added `parentXPath` parameter to `_parseFromPosition` methods and successfully passes it through recursive calls. However:

- **Limitation**: Only works for direct `_parseFromPosition` calls
- **Missing**: Buffered XML reparsing (line 589) starts a new parser via `_parseAsync`, which has no mechanism to receive `parentXPath`
- **Result**: Nested objects inside arrays still fail to parse relative XPath

### Evidence

Test case from `test-debug.js`:
```javascript
const itemSchema = x.object({
  sku: x.string().xpath('./@sku'),    // ❌ Returns empty string
  name: x.string().xpath('./name'),    // ✅ Works
  price: x.number().xpath('./price'),  // ✅ Works
});

const schema = x.object({
  items: x.array(itemSchema, '//item'),
});
```

Result: `{ items: [{ sku: '', name: 'Smartphone', price: 599.99 }] }`

**Why `name` and `price` work but `sku` doesn't**:
- `name` and `price` are child elements matched during iteration
- `sku` is an attribute that should be extracted from `startEvent` in `parseObjectFromPosition`
- The attribute extraction logic (lines 488-502) runs, but due to buffering flow, the context is lost

## Option A Architecture

### High-Level Approach

Replace XML buffering with **direct State Machine integration** for nested object parsing:

1. When `parseObjectFromPosition` encounters object fields, register them with State Machine
2. State Machine handles XPath resolution using `buildFullParentPath` (already implemented in Solution 4)
3. Events are processed through State Machine instead of buffering → reparsing
4. Parent context is preserved through `SchemaActivation` chain

### Key Insight

**State Machine already has the infrastructure we need!** (from `XmlParsingStateMachine.ts`):
- ✅ `buildFullParentPath()` - traverses parent activation chain
- ✅ `resolveXPath()` - resolves relative XPath against parent
- ✅ `onSchemaActivatedSync()` - registers nested object fields
- ✅ `registerSchema()` - creates activation with parent link

**What's missing**: Using State Machine in `parseObjectFromPosition` instead of direct XPathMatcher creation.

## Detailed Implementation Plan

### Phase 1: Refactor parseObjectFromPosition to use State Machine

**File**: `packages/stax-xml/src/converter/XmlParserInternal.ts`

**Current Code** (lines 422-595):
```typescript
async parseObjectFromPosition<T>(..., parentXPath?: string): Promise<T> {
  const result: any = {};
  const fieldMatchers = new Map<...>();

  // Initialize matchers for all fields
  for (const [key, schema] of Object.entries(shape)) {
    const originalXPath = this.extractXPath(schema);
    const resolvedXPath = originalXPath ?
      this.resolveRelativeXPath(originalXPath, parentXPath) : undefined;

    fieldMatchers.set(key, {
      schema,
      matcher: resolvedXPath ? new XPathMatcher(resolvedXPath) : undefined,
      // ...
    });
  }

  // Manual event iteration and matching...
}
```

**New Approach**:
```typescript
async parseObjectFromPosition<T>(
  iterator: AsyncIterator<AnyXmlEvent>,
  startEvent: StartElementEvent,
  startDepth: number,
  shape: Record<string, any>,
  schemaOptions: { xpath?: string },
  parentActivation?: SchemaActivation  // Changed from parentXPath
): Promise<T> {
  // Create State Machine instance
  const stateMachine = new XmlParsingStateMachine(this.options);
  const rootCollector: ObjectCollector = { type: 'object', fields: new Map() };

  // Register all field schemas with State Machine
  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    const xpath = this.extractXPath(fieldSchema);
    if (!xpath) continue;

    // Create collector for this field
    const childCollector = this.createCollectorForSchema(fieldSchema);

    // Register with State Machine, passing parent activation
    stateMachine.registerSchema(
      fieldSchema,
      xpath,  // State Machine will resolve relative XPath internally
      childCollector,
      parentActivation,  // Link to parent for XPath resolution
      fieldName
    );

    rootCollector.fields.set(fieldName, childCollector);
  }

  // Process startEvent
  stateMachine.processEventAsync(startEvent);

  // Iterate through events using State Machine
  let currentDepth = startDepth;
  let iterResult = await iterator.next();

  while (!iterResult.done && currentDepth >= startDepth) {
    const event = iterResult.value;

    // Let State Machine handle event processing
    await stateMachine.processEventAsync(event);

    // Track depth
    if (isStartElement(event)) currentDepth++;
    else if (isEndElement(event)) {
      currentDepth--;
      if (currentDepth < startDepth) break;
    }

    iterResult = await iterator.next();
  }

  // Extract result from collectors
  return this.buildResultFromCollector(rootCollector, shape) as T;
}
```

### Phase 2: Update SchemaActivation Interface

**File**: `packages/stax-xml/src/converter/XmlParsingStateMachine.ts`

**Current** (line 52):
```typescript
export interface SchemaActivation {
  schema: XmlSchemaBase<any, any>;
  xpath: string;
  matcher: XPathMatcher;
  depth: number;
  collector: Collector<any>;
  parentActivation?: SchemaActivation;
  fieldName?: string;
}
```

**No changes needed!** Already has `parentActivation` field.

### Phase 3: Update XmlObjectSchema._parseFromPosition Signature

**File**: `packages/stax-xml/src/converter/XmlObjectSchema.ts`

**Change signature** (line 50):
```typescript
// Old
_parseFromPosition(
  iterator: Iterator<AnyXmlEvent> | AsyncIterator<AnyXmlEvent>,
  startEvent: StartElementEvent,
  startDepth: number,
  options?: ParseOptions,
  parentXPath?: string  // ← Remove
): InferObjectOutput<T> | Promise<InferObjectOutput<T>>

// New
_parseFromPosition(
  iterator: Iterator<AnyXmlEvent> | AsyncIterator<AnyXmlEvent>,
  startEvent: StartElementEvent,
  startDepth: number,
  options?: ParseOptions,
  parentActivation?: SchemaActivation  // ← Add
): InferObjectOutput<T> | Promise<InferObjectOutput<T>>
```

**Update calls to parseObjectFromPosition**:
```typescript
return parser.parseObjectFromPosition(
  iterator as AsyncIterator<AnyXmlEvent>,
  startEvent,
  startDepth,
  this.shape,
  this.options,
  parentActivation  // Pass activation instead of xpath string
) as Promise<InferObjectOutput<T>>;
```

### Phase 4: Update Array Parsing to Create Activation

**File**: `packages/stax-xml/src/converter/XmlParserInternal.ts`

**Location**: Lines 643-655 (and sync/other variants)

**Current**:
```typescript
const value = await elementSchema._parseFromPosition(
  parser,
  event,
  context.currentDepth,
  this.options,
  xpath  // Pass array xpath as parent
);
```

**New**:
```typescript
// Create a temporary activation for the array context
const arrayActivation: SchemaActivation = {
  schema: elementSchema,
  xpath: xpath,  // Array's XPath
  matcher: matcher,
  depth: context.currentDepth,
  collector: { type: 'object', fields: new Map() },  // Dummy collector
  parentActivation: undefined,  // Arrays are typically top-level
  fieldName: undefined
};

const value = await elementSchema._parseFromPosition(
  parser,
  event,
  context.currentDepth,
  this.options,
  arrayActivation  // Pass activation object
);
```

### Phase 5: Add Helper Methods

**File**: `packages/stax-xml/src/converter/XmlParserInternal.ts`

**Add new methods**:

```typescript
/**
 * Create collector for a schema based on its type
 * @internal
 */
private createCollectorForSchema(schema: any): Collector<any> {
  const unwrapped = this.unwrapSchema(schema);
  const schemaType = unwrapped?.constructor?.name;

  switch (schemaType) {
    case 'XmlArraySchema':
      return { type: 'array', items: [] } as ArrayCollector<any>;
    case 'XmlStringSchema':
      return { type: 'string', buffer: '' } as StringCollector;
    case 'XmlNumberSchema':
      return { type: 'number', buffer: '' } as NumberCollector;
    case 'XmlObjectSchema':
      return { type: 'object', fields: new Map() } as ObjectCollector;
    default:
      return { type: 'string', buffer: '' } as StringCollector;
  }
}

/**
 * Build result object from collector
 * @internal
 */
private buildResultFromCollector(collector: ObjectCollector, shape: Record<string, any>): any {
  const result: any = {};

  for (const [fieldName, fieldCollector] of collector.fields) {
    const schema = shape[fieldName];

    if (fieldCollector.type === 'array') {
      result[fieldName] = (fieldCollector as ArrayCollector<any>).items;
    } else if (fieldCollector.type === 'string') {
      const value = (fieldCollector as StringCollector).value ??
                    (fieldCollector as StringCollector).buffer;
      result[fieldName] = this.parseFieldValue(value, schema);
    } else if (fieldCollector.type === 'number') {
      const value = (fieldCollector as NumberCollector).value ??
                    (fieldCollector as NumberCollector).buffer;
      result[fieldName] = this.parseFieldValue(value, schema);
    } else if (fieldCollector.type === 'object') {
      const objSchema = this.unwrapSchema(schema);
      if (objSchema?.constructor?.name === 'XmlObjectSchema') {
        const objShape = (objSchema as any).shape;
        result[fieldName] = this.buildResultFromCollector(
          fieldCollector as ObjectCollector,
          objShape
        );
      }
    }
  }

  return result;
}
```

### Phase 6: Add Async Support to State Machine

**File**: `packages/stax-xml/src/converter/XmlParsingStateMachine.ts`

**Current**: Only has `processEventSync`

**Add**:
```typescript
/**
 * Process events asynchronously
 */
async processEventAsync(event: AnyXmlEvent): Promise<void> {
  // For now, delegate to sync version
  // In future, this could handle async schema processing
  this.processEventSync(event);
}
```

## Implementation Steps

### Step 1: Add State Machine async method (5 min)
- File: `XmlParsingStateMachine.ts`
- Add `processEventAsync` method
- Simple delegation to `processEventSync` for now

### Step 2: Add helper methods to XmlParserInternal (30 min)
- File: `XmlParserInternal.ts`
- Add `createCollectorForSchema`
- Add `buildResultFromCollector`
- Test with simple cases

### Step 3: Refactor parseObjectFromPosition (async) (2 hours)
- File: `XmlParserInternal.ts`
- Replace manual matching with State Machine
- Update signature to accept `parentActivation`
- Remove XML buffering logic
- Test with nested object arrays

### Step 4: Refactor parseObjectFromPositionSync (1 hour)
- File: `XmlParserInternal.ts`
- Apply same changes as async version
- Ensure sync/async parity

### Step 5: Update XmlObjectSchema (15 min)
- File: `XmlObjectSchema.ts`
- Change `parentXPath` to `parentActivation`
- Update all calls to `parseObjectFromPosition`

### Step 6: Update array parsing calls (30 min)
- File: `XmlParserInternal.ts`
- Create temporary `SchemaActivation` in array parsing
- Update all 4 locations (2 async + 2 sync)

### Step 7: Remove Option B code (15 min)
- Remove `parentXPath` parameters
- Remove `resolveRelativeXPath` calls
- Remove `originalXPath` tracking
- Clean up unused code

### Step 8: Run tests and debug (2 hours)
- Run full test suite
- Expect 15-20 fixes
- Debug remaining failures
- Verify no regressions

**Total Estimated Time**: 6-8 hours

## Expected Test Results

### Before Option A
- 31 failed / 249 tests (87.6%)

### After Option A (Expected)
- 10-16 failed / 249 tests (93.6-96%)
- Fixed categories:
  - ✅ Nested object arrays (xpath-mapping.test.ts: 6-7 tests)
  - ✅ Complex shapes (complex-shapes.test.ts: 4-5 tests)
  - ✅ Integration tests (integration.test.ts: 2 tests)
  - ✅ Deep nesting tests (deep-nesting.test.ts: 3-4 tests)

### Remaining Failures (Expected)
- Writer tests (3): Unrelated to parsing
- Wildcard matching (1): Separate issue
- Event streaming (4): Different problem domain
- Edge cases (2-5): Require individual analysis

## Critical Files

### Primary Modifications
1. `packages/stax-xml/src/converter/XmlParserInternal.ts` (lines 422-595, 236-410)
2. `packages/stax-xml/src/converter/XmlObjectSchema.ts` (lines 50-99)
3. `packages/stax-xml/src/converter/XmlParsingStateMachine.ts` (add async method)

### Supporting Files
4. `packages/stax-xml/src/converter/types.ts` (collector types)
5. `packages/stax-xml/src/converter/XmlArraySchema.ts` (may need updates)

## Testing Strategy

### Verification Test Case

Create `test-option-a.js`:
```javascript
const { x } = require('./packages/stax-xml/dist/converter.cjs');

const xml = `
<inventory>
  <item sku="ABC123" category="electronics">
    <name lang="en">Smartphone</name>
    <price currency="USD">599.99</price>
  </item>
</inventory>
`;

const itemSchema = x.object({
  sku: x.string().xpath('./@sku'),
  category: x.string().xpath('./@category'),
  name: x.string().xpath('./name'),
  nameLanguage: x.string().xpath('./name/@lang'),
  price: x.number().xpath('./price'),
  priceCurrency: x.string().xpath('./price/@currency'),
}).transform(item => ({
  ...item,
  priceInfo: `${item.price} ${item.priceCurrency}`,
  localizedName: `${item.name} (${item.nameLanguage})`
}));

const schema = x.object({
  items: x.array(itemSchema, '//item'),
});

const result = schema.parseSync(xml);

console.log('Expected: sku="ABC123", priceInfo="599.99 USD"');
console.log('Actual:', result.items[0]);

// Expected output:
// {
//   sku: 'ABC123',
//   category: 'electronics',
//   name: 'Smartphone',
//   nameLanguage: 'en',
//   price: 599.99,
//   priceCurrency: 'USD',
//   priceInfo: '599.99 USD',
//   localizedName: 'Smartphone (en)'
// }
```

### Test Execution
```bash
# Build
pnpm --filter stax-xml build

# Verify fix
node test-option-a.js

# Run full test suite
pnpm --filter stax-xml test test/converter

# Check specific tests
pnpm --filter stax-xml test test/converter/xpath-mapping.test.ts
pnpm --filter stax-xml test test/converter/complex-shapes.test.ts
```

## Rollback Plan

If Option A introduces regressions:

1. Git stash all changes
2. Return to Option B implementation
3. Consider hybrid approach:
   - Use State Machine for top-level parsing
   - Keep buffering for deeply nested cases
   - Gradual migration

## Success Criteria

- [ ] Test pass rate ≥ 94% (≤ 15 failures)
- [ ] No regressions in currently passing tests
- [ ] `test-option-a.js` produces expected output
- [ ] All nested object array tests pass
- [ ] Build succeeds without errors
- [ ] No performance regression (< 10% slower)

## Next Agent Checklist

Before starting implementation:
- [ ] Read this document completely
- [ ] Review current codebase state
- [ ] Run baseline tests: `pnpm --filter stax-xml test test/converter 2>&1 | grep "Test Files\|Tests "`
- [ ] Verify understanding of State Machine architecture
- [ ] Create backup branch: `git checkout -b backup-before-option-a`

During implementation:
- [ ] Follow steps in order
- [ ] Test after each major step
- [ ] Keep running test count to track progress
- [ ] Add debug logging if needed (search for `const isDebug`)

After implementation:
- [ ] Run full test suite
- [ ] Verify expected test fixes (15-20)
- [ ] Run `test-option-a.js` verification
- [ ] Document any unexpected issues
- [ ] Clean up debug code

## References

- State Machine implementation: `packages/stax-xml/src/converter/XmlParsingStateMachine.ts`
- Solution 4 (parent XPath resolution): Lines 476-531 in XmlParsingStateMachine.ts
- Current Option B code: XmlParserInternal.ts lines 1199-1214
- Failing tests: `NEXT_STEPS.md` lines 193-212
- Architecture overview: `CLAUDE.md` lines 30-82

## Contact Points

If blocked or uncertain:
1. Check State Machine debug logging: Set `isDebug = true` at line 114 in XmlParsingStateMachine.ts
2. Review collector architecture: `packages/stax-xml/src/converter/types.ts`
3. Examine working State Machine usage: `XmlParserInternal.parseObjectAsync` (lines 122-228)
4. Test individual components before integration

---

**Document Version**: 1.0
**Created**: 2025-10-02
**Status**: Ready for Implementation
**Estimated Completion**: 6-8 hours
