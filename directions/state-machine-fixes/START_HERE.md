# ⚡ START HERE - Next Agent Quick Guide

**Last Updated**: 2025-10-02
**Branch**: `remotes/origin/feature/declarative-converter`
**Status**: Core complete, 2 critical fixes needed

---

## 🚀 Immediate Actions (10 minutes)

### 1. Verify State (2 min)
```bash
cd /home/josh/programs/stax-xml
pnpm --filter stax-xml build
node test-option-a.js
```

**Expected**: Object with sku, category, name, price etc.
**Missing**: priceInfo, localizedName (transforms not applied ⚠️)

### 2. Read These Files (8 min)
1. `HANDOFF_20251002.md` - Latest session summary
2. `NEXT_TASKS.md` - Jump to **Task 1** (lines 10-170)

---

## 🎯 Your Mission

### Task 1: Fix Transform Application (2-3 hours) 🔴

**File**: `packages/stax-xml/src/converter/XmlParsingStateMachine.ts`

**What to do**:
1. Copy `getAllTransforms()` from NEXT_TASKS.md lines 89-112
2. Copy `extractValueWithTransforms()` from lines 117-127
3. Update `extractObjectFromCollector()` per lines 59-83

**Test**:
```bash
pnpm --filter stax-xml build
node test-option-a.js
# Should now show priceInfo: "599.99 USD"
```

**Success**: test-option-a.js output includes transformed fields

---

### Task 2: Fix Memory Leak (1-2 hours) 🔴

**Problem**: Heap overflow on large files

**Solution**: Mark temporary schemas, clean on deactivation

See NEXT_TASKS.md lines 173-263 for detailed steps.

---

## 📊 Current Test Status

| Suite | Status | Score |
|-------|--------|-------|
| basic.test.ts | ✅ PASS | 25/25 |
| transform.test.ts | ✅ PASS | 24/24 |
| complex-shapes.test.ts | ⚠️ PARTIAL | 8/14 |
| large-file.test.ts | ❌ FAIL | OOM |

---

## 🔧 Quick Debug

Enable debug logging:
```typescript
// XmlParsingStateMachine.ts lines 129, 160
const isDebug = true;
```

---

## 📚 Full Documentation

- `README.md` - Overview & testing strategy
- `CURRENT_STATUS.md` - Detailed status & architecture
- `NEXT_TASKS.md` - Step-by-step implementation guide
- `ARCHITECTURE_NOTES.md` - Deep technical reference
- `HANDOFF_20251002.md` - Latest session summary

---

## ✅ Success Criteria

- [ ] test-option-a.js shows priceInfo and localizedName
- [ ] All 25 basic tests pass
- [ ] All 24 transform tests pass
- [ ] Large file test completes without OOM
- [ ] No regressions

---

**Time estimate**: 3-5 hours to complete both critical tasks

**Let's go!** 🚀
