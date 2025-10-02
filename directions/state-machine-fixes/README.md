# State Machine Fixes - Agent Handoff Documentation

**Version**: 1.0
**Date**: 2025-10-02
**Status**: Core implementation complete, refinements needed

---

## 📁 Directory Structure

```
directions/state-machine-fixes/
├── START_HERE.md              ← 🚀 NEXT AGENT: START HERE (Quick guide)
├── HANDOFF_20251002.md        ← Latest session summary
├── README.md                  ← You are here (Overview)
├── CURRENT_STATUS.md          ← What was accomplished
├── NEXT_TASKS.md              ← What to do next (PRIORITY ORDER)
└── ARCHITECTURE_NOTES.md      ← Deep technical understanding
```

---

## 🎯 Quick Start for Next Agent

### 0. ⚡ Fastest Start

**Read `START_HERE.md` first** - 10 minute quick guide to get started immediately.

### Alternative: Full Context

**Read `HANDOFF_20251002.md`** - Complete session summary with architecture overview.

### 1. Read in This Order

1. **CURRENT_STATUS.md** (5 min)
   - Understand what's working and what's broken
   - See test results summary
   - Review the working example

2. **NEXT_TASKS.md** (10 min)
   - Start with Task 1: Fix Transform Application (CRITICAL)
   - Tasks are ordered by priority
   - Each task has step-by-step instructions

3. **ARCHITECTURE_NOTES.md** (15 min, skim first)
   - Reference when you need to understand WHY something works
   - Use for debugging complex issues
   - Contains data flow examples

### 2. Verify Current State

```bash
# Navigate to project
cd /home/josh/programs/stax-xml

# Build
pnpm --filter stax-xml build

# Quick test
node test-option-a.js

# Expected output (mostly correct, but missing transforms):
# {
#   sku: "ABC123",
#   category: "electronics",
#   name: "Smartphone",
#   nameLanguage: "en",
#   price: 599.99,
#   priceCurrency: "USD"
#   // Missing: priceInfo, localizedName (these are transforms!)
# }

# Run basic tests
pnpm --filter stax-xml test test/converter/basic.test.ts
# Should show: 25/25 PASS

# Run transform tests
pnpm --filter stax-xml test test/converter/transform.test.ts
# Should show: 24/24 PASS
```

### 3. Start with Task 1

**File to edit**: `packages/stax-xml/src/converter/XmlParsingStateMachine.ts`

**Goal**: Make transforms work

**What you'll do**:
1. Add `getAllTransforms()` helper method (copy from NEXT_TASKS.md)
2. Update `extractObjectFromCollector()` to apply transforms
3. Test with `node test-option-a.js`
4. Look for `priceInfo` in output

**Estimated time**: 2-3 hours

---

## 🚨 Critical Information

### What Works ✅

- Basic XML parsing (elements, text)
- Attributes on elements (`./@attr`)
- Nested attributes (`./element/@attr`)
- Arrays of simple values
- Arrays of objects
- Nested objects
- All basic schema types (string, number, object, array)

### What's Broken ❌

1. **Transforms not applied** (HIGH PRIORITY)
   - Objects parse correctly
   - But `.transform()` doesn't run
   - Fix in Task 1

2. **Memory leak** (HIGH PRIORITY)
   - Large files cause heap overflow
   - Schema cleanup missing
   - Fix in Task 2

3. **Some complex shapes** (MEDIUM PRIORITY)
   - Jagged arrays
   - Recursive structures
   - Fix in Tasks 3-5

### Don't Touch ⛔

These parts are working perfectly, don't modify unless absolutely necessary:

- `matchesInContext()` - XPath matching logic
- Attribute immediate extraction
- Schema unwrapping
- Basic activation/deactivation flow
- `parseArrayAsync()` / `parseArray()` main logic

---

## 🔬 Testing Strategy

### Quick Feedback Loop

```bash
# 1. Make a change
# 2. Build (fast - only changed files)
pnpm --filter stax-xml build

# 3. Test immediately
node test-option-a.js

# 4. See result in 2 seconds
```

### Incremental Testing

```bash
# After each task completion:

# Basic sanity check
pnpm --filter stax-xml test test/converter/basic.test.ts

# Your specific fix
pnpm --filter stax-xml test test/converter/transform.test.ts  # After Task 1
pnpm --filter stax-xml test test/converter/large-file.test.ts  # After Task 2

# Complex cases
pnpm --filter stax-xml test test/converter/complex-shapes.test.ts
```

### Full Test Suite

```bash
# Only run this after major milestones
# WARNING: Takes 1-2 minutes and uses lots of memory
pnpm --filter stax-xml test test/converter
```

---

## 🐛 Common Issues You Might Face

### Issue: "Cannot read property 'shape' of undefined"

**Cause**: Forgot to unwrap schema
**Fix**:
```typescript
// BAD
const shape = schema.shape;

// GOOD
const unwrapped = this.unwrapSchema(schema);
const shape = unwrapped.shape;
```

### Issue: Transforms still not working

**Debug**:
```typescript
// Add logging in extractObjectFromCollector
console.log('Original schema:', schema.constructor.name);
console.log('Unwrapped schema:', this.unwrapSchema(schema).constructor.name);
console.log('Transforms found:', this.getAllTransforms(schema).length);
console.log('Before transform:', result);
// Apply transforms
console.log('After transform:', result);
```

### Issue: Memory keeps growing

**Debug**:
```typescript
// Add to processEventSync
if (isEndElement(event)) {
  console.log('Active schemas:', this.activeSchemas.length);
  // This number should NOT keep growing!
}
```

### Issue: Tests timeout

**Cause**: Infinite loop or missing deactivation
**Fix**: Check that every activation has corresponding deactivation

---

## 📊 Success Metrics

### Task 1 Success (Transforms)
- ✅ `node test-option-a.js` shows `priceInfo` and `localizedName`
- ✅ All 24 transform tests still pass
- ✅ No regression in basic tests

### Task 2 Success (Memory)
- ✅ Large file test completes without crash
- ✅ Active schemas count stays < 50
- ✅ Performance is acceptable

### Overall Success
- ✅ Basic: 25/25 pass
- ✅ Transform: 24/24 pass
- ✅ Complex: 10+/14 pass (some edge cases acceptable)
- ✅ Large files: complete without OOM

---

## 🆘 Getting Help

### Understanding the Code

1. Read ARCHITECTURE_NOTES.md section on the topic
2. Use the data flow examples
3. Enable debug logging:
   ```typescript
   // Line 129 and 160 in XmlParsingStateMachine.ts
   const isDebug = true;
   ```

### Stuck on a Task

1. Check NEXT_TASKS.md "If Stuck" section
2. Run the debug commands provided
3. Add more logging to understand flow
4. Compare with similar working code

### Test Failures

1. Run single test: `pnpm test path/to/test.ts -t "test name"`
2. Enable debug mode
3. Check CURRENT_STATUS.md for known failures
4. Use ARCHITECTURE_NOTES.md to understand expected flow

---

## 📝 Before You Finish

### Update Documentation

1. **CURRENT_STATUS.md**
   - Update test results section
   - Note any new issues discovered
   - Update "What Works" / "What's Broken"

2. **Create Handoff Summary**
   ```bash
   # Create new handoff document
   touch directions/state-machine-fixes/HANDOFF_$(date +%Y%m%d).md
   ```

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "fix: apply transforms in State Machine extraction

   - Added getAllTransforms() helper
   - Updated extractObjectFromCollector() to apply transforms
   - Fixed Task 1 from state-machine-fixes/NEXT_TASKS.md
   - Tests: transform 24/24, basic 25/25

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

### Test Everything

```bash
# Full test before handoff
pnpm --filter stax-xml build
pnpm --filter stax-xml test test/converter/basic.test.ts
pnpm --filter stax-xml test test/converter/transform.test.ts
pnpm --filter stax-xml test test/converter/complex-shapes.test.ts

# Document results in CURRENT_STATUS.md
```

---

## 🎓 Learning Resources

### Understanding State Machines
- See "Event-Driven State Machine" diagram in ARCHITECTURE_NOTES.md
- Review data flow example with actual XML

### Understanding XPath Matching
- See "Context-Based Matching" in ARCHITECTURE_NOTES.md
- Examples cover all patterns: `./@attr`, `./element`, `./element/@attr`

### Understanding Collectors
- See "Core Architecture" in ARCHITECTURE_NOTES.md
- Collectors are type-specific accumulators (string, number, array, object)

---

## 📞 Handoff Checklist

Before passing to next agent:

- [ ] All code changes documented
- [ ] Build succeeds
- [ ] At least basic tests pass
- [ ] CURRENT_STATUS.md updated
- [ ] New issues documented
- [ ] Next priorities identified
- [ ] Handoff summary created

---

## 🎯 Final Notes

**Philosophy**: The State Machine is now the single source of truth for all XML parsing.
Don't try to work around it - enhance it.

**Debugging**: When in doubt, add logging. The State Machine is complex but logical.
Every activation has a corresponding deactivation.

**Testing**: Test incrementally. Don't make 10 changes then test - make 1 change and test immediately.

**Documentation**: Update docs as you go. Future you (or next agent) will thank you.

---

**Good luck! The hard part is done. You're just polishing now.** 🚀
