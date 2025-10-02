# Context-Based State Machine Approach - Analysis

## What We Implemented

1. **MatchContext Interface**: Added context tracking for relative XPath evaluation
2. **Context-Based Matching**: `matchesInContext()` method that evaluates XPath relative to current context depth
3. **Automatic Context Creation**: When object/array activates, creates context for its child fields
4. **Removed Path Resolution**: No more `resolveXPath()` or `buildFullParentPath()` - paths stay as-is

## Current Issue

**Problem**: Array of objects still returns strings instead of objects.

```javascript
// Expected:
{ items: [{ sku: 'ABC123', name: 'Smartphone', price: 599.99, ... }] }

// Actual:
{ items: "Smartphone599.99" }
```

## Root Cause

The architecture has a fundamental split:

1. **State Machine Flow** (works correctly):
   - Registers schemas with contexts
   - Activates array elements
   - Creates contexts for object fields
   - Collectors properly structured

2. **parseObjectFromPosition Flow** (bypasses State Machine):
   - Creates NEW State Machine instance
   - Doesn't connect to parent State Machine's context
   - Results extracted incorrectly

### The Disconnect

When parsing arrays:
```
parseArrayFromPosition()
  → Finds array element (object)
  → Calls element._parseFromPosition()  ← HERE!
  → XmlObjectSchema._parseFromPosition()
  → parseObjectFromPosition()
  → Creates NEW StateMachine  ← PROBLEM!
```

The State Machine ALREADY registered the object's fields when the array element activated, but `parseObjectFromPosition` creates a separate State Machine that doesn't see this structure!

## Solution Approaches

### Approach 1: Remove parseObjectFromPosition (Ideal but Big Change)

Make all parsing go through ONE State Machine:

```typescript
async parseArrayFromPosition<T>(iterator, startEvent, startDepth, elementSchema, xpath) {
  // Don't call element._parseFromPosition()!
  // State Machine already registered object fields

  // Just keep processing events
  for await (event of iterator) {
    await stateMachine.process(event);
    if (currentDepth < startDepth) break;
  }

  // Extract from State Machine's collectors
  return stateMachine.extractResults();
}
```

**Impact**: Must refactor all `parseArray*` methods to use State Machine.

### Approach 2: Share State Machine Instance (Medium Change)

Pass the State Machine through the call chain:

```typescript
_parseFromPosition(iterator, startEvent, startDepth, options, context, stateMachine?) {
  const sm = stateMachine || new XmlParsingStateMachine();
  // Use same State Machine throughout
}
```

**Impact**: Change signatures of `_parseFromPosition` across all schemas.

### Approach 3: Fix Collector Extraction (Small Change)

The State Machine's collectors are correct! Fix how we extract from them:

```typescript
async parseArrayFromPosition<T>(...) {
  // Instead of calling element._parseFromPosition():

  if (elementType === 'XmlObjectSchema') {
    // State Machine ALREADY has this object's collectors
    // Just extract the result from current activation's collector
    const arrayCollector = currentActivation.collector;
    const itemCollector = arrayCollector.currentItem;

    // Wait for object to complete, then extract
    // ...
  }
}
```

**Impact**: Modify only array parsing methods.

## Recommended Next Steps

Given the complexity and architectural implications:

1. **Option 1 - Quick Fix (Recommended)**:
   - Revert to previous working state (before Option A)
   - Apply minimal fix to XPath resolution bug
   - Document the limitation
   - Plan proper State Machine integration for v2

2. **Option 2 - Continue Current Approach**:
   - Implement Approach 3 above (fix collector extraction)
   - Test thoroughly
   - May still have edge cases

3. **Option 3 - Full Refactor** (Future):
   - Design unified parsing architecture
   - Single State Machine for entire document
   - Remove position-based parsing methods
   - v2.0 breaking change

## Key Insight

The context-based matching logic IS correct and works! The problem is NOT the State Machine, but how `parseObjectFromPosition` creates a separate instance instead of using the existing one.

The State Machine already correctly:
- Creates contexts
- Registers child fields
- Matches relative XPaths
- Populates collectors

We just need to USE those collectors instead of creating new State Machines!
