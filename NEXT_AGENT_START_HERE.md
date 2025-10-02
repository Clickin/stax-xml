# 🚀 Next Agent: Start Here

## TL;DR - What You Need to Know

**Problem**: Nested object arrays parse as strings instead of objects.

**Root Cause**: `parseObjectFromPosition` creates duplicate State Machine instances.

**Solution**: Thread State Machine as parameter through the call chain.

**Status**: 95% done. Context-based matching logic ✅ works. Just need parameter threading.

## 📋 Quick Start (5 minutes)

1. **Read These Files in Order**:
   ```
   1. IMPLEMENTATION_STATUS.md        ← Current state, what's done, what's not
   2. NESTED_OBJECT_ARRAY_FIX_PLAN.md ← Complete implementation guide
   3. CONTEXT_BASED_APPROACH_ANALYSIS.md ← Why context-based approach is right
   ```

2. **Verify Current State**:
   ```bash
   cd /home/josh/programs/stax-xml
   pnpm --filter stax-xml build           # Should succeed ✅
   node test-option-a.js                  # Should show "Smartphone599.99" ❌
   ```

3. **Understand the Fix**:
   - State Machine exists ✅
   - Context matching works ✅
   - Problem: We create duplicate State Machines ❌
   - Fix: Pass State Machine as parameter ✅

## 🎯 Your Mission

### Goal
Change test output from:
```
Actual: "Smartphone599.99"
```

To:
```
Actual: {
  "sku": "ABC123",
  "name": "Smartphone",
  "price": 599.99,
  ...
}
```

### How
Follow `NESTED_OBJECT_ARRAY_FIX_PLAN.md` Phase 2:

1. Add `stateMachine` parameter to `_parseFromPosition` methods
2. Pass State Machine through call chain
3. Remove `new XmlParsingStateMachine()` from nested methods
4. Test after each change

## 📁 Files You'll Modify

### Primary (Must Change)
1. `packages/stax-xml/src/converter/XmlParserInternal.ts`
   - Lines 303-344: `parseObjectFromPosition` (async)
   - Lines 237-297: `parseObjectFromPositionSync`
   - Lines 493-687: `parseArrayFromPosition*` methods

2. `packages/stax-xml/src/converter/XmlObjectSchema.ts`
   - Lines 51-99: `_parseFromPosition` signature

3. `packages/stax-xml/src/converter/XmlArraySchema.ts`
   - `_parseFromPosition` signature (check if exists)

### Don't Touch (Already Correct)
- ✅ `XmlParsingStateMachine.ts` - Context logic is done
- ✅ Context-based matching - Works perfectly
- ✅ Collector structure - Correct

## 🧪 Testing Strategy

### Quick Test (After Each Change)
```bash
pnpm --filter stax-xml build && node test-option-a.js
```

Look for this output to improve:
- ❌ Current: `"Smartphone599.99"`
- ✅ Target: Object with `sku`, `name`, `price` fields

### Full Test (After Complete)
```bash
pnpm --filter stax-xml test test/converter
```

Target: <10 failed tests (from current 39)

### Specific Tests to Watch
```bash
# These should pass when done:
pnpm --filter stax-xml test test/converter/complex-shapes.test.ts -t "jagged arrays"
pnpm --filter stax-xml test test/converter/complex-shapes.test.ts -t "nested data structures"
```

## 🔍 Example Change Pattern

### BEFORE (Wrong - Creates New Instance)
```typescript
async parseObjectFromPosition<T>(
  iterator: AsyncIterator<AnyXmlEvent>,
  startEvent: StartElementEvent,
  startDepth: number,
  shape: Record<string, any>,
  schemaOptions: { xpath?: string },
  parentActivation?: SchemaActivation
): Promise<T> {
  const stateMachine = new XmlParsingStateMachine(this.options); // ❌ DUPLICATE!
  // ...
}
```

### AFTER (Correct - Receives Instance)
```typescript
async parseObjectFromPosition<T>(
  iterator: AsyncIterator<AnyXmlEvent>,
  startEvent: StartElementEvent,
  startDepth: number,
  shape: Record<string, any>,
  schemaOptions: { xpath?: string },
  stateMachine: XmlParsingStateMachine,  // ✅ PARAMETER
  parentContext?: MatchContext
): Promise<T> {
  // Use provided stateMachine - collectors already registered!
  // Just process events and extract results
}
```

## 🐛 Debug Tips

If stuck, enable debug logging:

```typescript
// In XmlParsingStateMachine.ts, line ~130
const isDebug = true; // Change to true

// Watch for:
// - Schema activations
// - Context depths
// - XPath matching
```

Check collector structure:
```typescript
console.log('Collector:', JSON.stringify(collector, (k, v) =>
  v instanceof Map ? `Map(${v.size})` : v, 2
));
```

## ⚠️ Common Pitfalls

### DON'T:
- ❌ Create new State Machine in nested methods
- ❌ Change the context-based matching logic
- ❌ Remove MatchContext infrastructure
- ❌ Try a completely different approach

### DO:
- ✅ Thread State Machine through parameters
- ✅ Trust the context matching (it works!)
- ✅ Test incrementally
- ✅ Follow the plan document

## 📊 Progress Tracking

Current: **Phase 1 Complete, Phase 2 Started**

- [x] Phase 1: Context-based matching infrastructure
- [ ] Phase 2: Thread State Machine through calls ← **YOU ARE HERE**
- [ ] Phase 3: Remove fallback instance creation
- [ ] Phase 4: Testing & validation

## 💡 Key Insight

**The State Machine ALREADY does everything correctly!**

When an array element activates:
1. ✅ Creates context for the element
2. ✅ Registers object fields with relative XPath
3. ✅ Matches fields based on context depth
4. ✅ Populates collectors correctly

We just need to **USE** those collectors instead of creating new ones!

## 🎓 Understanding Check

Before coding, make sure you understand:

1. **Why does creating new State Machine break things?**
   > Because it loses parent context and duplicates collectors

2. **What is MatchContext?**
   > Tracks the current element's depth for relative XPath matching

3. **Why thread State Machine as parameter?**
   > So nested parsing uses same State Machine = same collectors = correct results

4. **Where are the correct results?**
   > In the State Machine's collectors that were registered by parent activation

If unsure, re-read `NESTED_OBJECT_ARRAY_FIX_PLAN.md` sections:
- "Root Cause"
- "The Solution: Unified State Machine Architecture"
- "Why This Will Work"

## 🏁 Success Criteria

When done:
- ✅ `test-option-a.js` shows object (not string)
- ✅ Nested object array tests pass
- ✅ <10 failed tests total
- ✅ No performance regression

## 📞 Questions?

All answers are in:
- `NESTED_OBJECT_ARRAY_FIX_PLAN.md` - Detailed implementation guide
- `IMPLEMENTATION_STATUS.md` - What's done, what's not
- `CONTEXT_BASED_APPROACH_ANALYSIS.md` - Why context approach works

## Ready? Let's Go! 🚀

```bash
# Verify you're in the right place
pwd  # Should be /home/josh/programs/stax-xml

# Read the plan
cat NESTED_OBJECT_ARRAY_FIX_PLAN.md

# Start coding
code packages/stax-xml/src/converter/XmlParserInternal.ts
```

You got this! The hard part is done. Just wire it up! 💪
