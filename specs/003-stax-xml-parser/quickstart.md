# Quickstart: Test Coverage Enhancement

**Feature**: Converter Module Coverage to 95%+
**Date**: 2025-10-03

This guide helps developers understand, run, and improve test coverage for the stax-xml converter module.

---

## Running Coverage

### Quick Coverage Check

```bash
# From repository root
pnpm coverage
```

This runs all tests with coverage instrumentation and displays a detailed report.

### Coverage Output

```
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
XmlOptionalSchema  |   57.14 |    81.81 |   71.42 |   57.14 | 57,65-66,75-79
XmlParserInternal  |   43.69 |    81.98 |   60.71 |   43.69 | 56-118,142-212,...
XmlStringSchema    |   54.05 |      100 |   66.66 |   54.05 | 38-52,55-77,80-102
XmlArraySchema     |   64.55 |      100 |    87.5 |   64.55 | 39-71
```

**Key Metrics**:
- **% Stmts**: Statement coverage (our primary metric)
- **% Branch**: Branch/condition coverage
- **% Funcs**: Function coverage
- **% Lines**: Line coverage
- **Uncovered Line #s**: Specific uncovered lines

---

## Understanding Coverage Gaps

### Module Priority

1. **XmlParserInternal** (43.69% → 95%+)
   - Core parsing engine
   - Most critical for correctness
   - Largest coverage gap

2. **XmlOptionalSchema** (57.14% → 95%+)
   - Optional value handling
   - Important for nullable fields

3. **XmlStringSchema** (54.05% → 95%+)
   - String parsing and writing
   - Text collection logic

4. **XmlArraySchema** (64.55% → 95%+)
   - Array parsing and iteration
   - Closest to target

### Identifying What to Test

**Step 1**: Look at "Uncovered Line #s"
```
XmlOptionalSchema: 57,65-66,75-79
```

**Step 2**: Open source file and navigate to those lines:
```bash
# Open in your editor
code packages/stax-xml/src/converter/XmlOptionalSchema.ts:57
```

**Step 3**: Identify the code path:
- Line 57: Likely an `if (value === undefined)` check
- Lines 65-66: Async method variant
- Lines 75-79: ParseText method

**Step 4**: Design tests to hit those lines

---

## Writing New Tests

### Test File Structure

```typescript
import { describe, expect, it } from 'vitest';
import { x } from '../../src/converter/index.js';

describe('XmlOptionalSchema', () => {
  describe('Parse Methods', () => {
    it('should return undefined when value is undefined', () => {
      // Arrange
      const schema = x.object({
        optional: x.string().optional().xpath('//value')
      });
      const xml = '<root></root>'; // No <value> element

      // Act
      const result = schema.parseSync(xml);

      // Assert
      expect(result.optional).toBeUndefined();
    });
  });
});
```

### Test Naming Convention

Follow pattern: **"should [expected behavior] when [condition]"**

Examples:
- ✅ `should return undefined when value is undefined`
- ✅ `should parse string when XPath matches element`
- ✅ `should throw error when XML is malformed`
- ❌ `test optional parse` (too vague)
- ❌ `parseOptional()` (not descriptive)

### Arrange-Act-Assert Pattern

```typescript
it('should parse nested object when no XPath specified', () => {
  // Arrange: Set up test data
  const schema = x.object({
    user: x.object({
      name: x.string().xpath('//name')
    })
  });
  const xml = '<root><user><name>John</name></user></root>';

  // Act: Execute the operation
  const result = schema.parseSync(xml);

  // Assert: Verify expectations
  expect(result.user.name).toBe('John');
});
```

---

## Testing Private Methods

**Common Practice**: Test through public API, not directly

### ❌ Don't Do This

```typescript
// Bad: Accessing private method directly
const parser = new XmlParserInternal();
const result = (parser as any).extractXPath(schema); // Breaks encapsulation
```

### ✅ Do This Instead

```typescript
// Good: Test behavior through public API
it('should extract XPath from schema during parsing', () => {
  const schema = x.string().xpath('//element');
  const xml = '<root><element>value</element></root>';

  // extractXPath is called internally by parseSync
  const result = schema.parseSync(xml);

  expect(result).toBe('value'); // Validates extractXPath worked
});
```

**Rationale**:
- Private methods are implementation details
- Public API tests validate integration
- Refactoring private methods doesn't break tests
- Aligns with TypeScript best practices

---

## Common Test Scenarios

### Testing Error Handling

```typescript
it('should throw clear error when XML is malformed', () => {
  const schema = x.string().xpath('//element');

  expect(() => {
    schema.parseSync('<root><unclosed>');
  }).toThrow(/malformed|parse error/i);
});
```

### Testing Async Variants

```typescript
it('should parse string asynchronously', async () => {
  const schema = x.string().xpath('//element');
  const xml = '<root><element>async value</element></root>';

  const result = await schema.parse(xml); // Async

  expect(result).toBe('async value');
});
```

### Testing Edge Cases

```typescript
describe('Edge Cases', () => {
  it('should handle empty XML', () => {
    const schema = x.string().xpath('//element');
    const result = schema.parseSync('<root></root>');

    expect(result).toBe(''); // or toBeUndefined()
  });

  it('should handle whitespace-only text', () => {
    const schema = x.string().xpath('//element');
    const xml = '<root><element>   \n\t  </element></root>';

    const result = schema.parseSync(xml);

    // Depends on trimText option
    expect(result).toBe(''); // if trimText: true
  });

  it('should handle deeply nested structures', () => {
    const schema = x.object({
      level1: x.object({
        level2: x.object({
          level3: x.string().xpath('//value')
        })
      })
    });

    const xml = `
      <root>
        <level1>
          <level2>
            <level3><value>deep</value></level3>
          </level2>
        </level1>
      </root>
    `;

    const result = schema.parseSync(xml);

    expect(result.level1.level2.level3).toBe('deep');
  });
});
```

---

## Verifying Coverage Improvement

### After Adding Tests

1. **Run coverage**:
   ```bash
   pnpm coverage
   ```

2. **Check the specific module**:
   Look for the module you just added tests for in the coverage report

3. **Verify line coverage increased**:
   ```
   Before: XmlOptionalSchema | 57.14% | ...
   After:  XmlOptionalSchema | 78.25% | ... (example improvement)
   ```

4. **Check remaining uncovered lines**:
   ```
   Uncovered Line #s: 75-79 (reduced from 57,65-66,75-79)
   ```

5. **Repeat** until module reaches 95%+

### HTML Coverage Report

For detailed line-by-line coverage:

```bash
pnpm coverage
# Coverage report generated in coverage/ directory
```

Open `coverage/index.html` in browser to see:
- Red lines: Uncovered
- Green lines: Covered
- Yellow lines: Partially covered (branches)

---

## Performance Guidelines

### Keep Tests Fast

- Individual test should complete in <100ms
- Test file should complete in <2000ms
- Total suite should complete in <30s

### Avoid Slow Operations

```typescript
// ❌ Slow: Creating large XML documents unnecessarily
it('should parse huge document', () => {
  const xml = Array(100000).fill('<item>x</item>').join('');
  // Takes too long!
});

// ✅ Fast: Use minimal data to test the behavior
it('should parse multiple items', () => {
  const xml = '<root><item>1</item><item>2</item><item>3</item></root>';
  // Tests the same logic, much faster
});
```

---

## Troubleshooting

### "Coverage didn't increase after adding tests"

**Possible causes**:
1. Test is not actually executing the uncovered code path
2. Test is similar to existing tests (redundant)
3. Need to test different input combinations

**Solution**: Check HTML coverage report to see which lines are still red

### "Test is flaky (sometimes passes, sometimes fails)"

**Possible causes**:
1. Test depends on timing (async race conditions)
2. Test depends on external state
3. Test uses non-deterministic data

**Solution**: Make tests deterministic
```typescript
// ❌ Flaky
it('should parse async', async () => {
  setTimeout(() => { /* something */ }, 100);
  // Timing-dependent!
});

// ✅ Deterministic
it('should parse async', async () => {
  const result = await schema.parse(xml);
  expect(result).toBe('expected');
});
```

### "Test fails but code looks correct"

**Debugging steps**:
1. Run single test: `pnpm test -- -t "test name"`
2. Add console.log to see actual vs expected values
3. Check if XML string is malformed (missing quotes, unclosed tags)
4. Verify schema configuration (XPath, writer config)

---

## Next Steps

1. **Run coverage** to see current state
2. **Pick a module** (start with XmlParserInternal - priority 1)
3. **Identify uncovered lines** in that module
4. **Write tests** following patterns in this guide
5. **Verify improvement** with coverage
6. **Repeat** until 95%+ achieved

---

**Ready to Start?**

```bash
# 1. Check current coverage
pnpm coverage

# 2. Open test file to expand
code packages/stax-xml/test/converter/parser-internal.test.ts

# 3. Add tests following the patterns above

# 4. Run tests
pnpm test

# 5. Verify coverage improved
pnpm coverage
```

---
*Quickstart guide for test coverage enhancement*
*See contracts/coverage-requirements.md for detailed test specifications*
