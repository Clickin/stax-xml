# Option A - Revised: Context-Based State Machine

## Core Concept

Instead of using global absolute XPaths, use **context-relative XPath evaluation**:
- When an object/array is activated, it becomes the new "context node"
- Child field XPaths are evaluated relative to this context
- State Machine processes events regardless of source (full parser or position-based iterator)

## Key Changes

### 1. Context-Relative XPath Matching

```typescript
// Instead of resolving relative XPath to absolute:
// ./price -> /root/item/price

// Keep it relative and match against current context:
// When <item> is active (depth=2), ./price matches <price> at depth=3
```

### 2. Unified Event Processing

```typescript
// Both methods use the same State Machine flow:
async parse(input) {
  const stateMachine = new StateMachine();
  const collector = this.createCollector();
  stateMachine.registerSchema(this, xpath, collector);

  for await (const event of createIterator(input)) {
    await stateMachine.process(event);
  }

  return stateMachine.extractResult(collector, this);
}

async _parseFromPosition(iterator, startEvent, startDepth, options, parentContext) {
  const stateMachine = new StateMachine();
  const collector = this.createCollector();

  // Register with parent context for relative matching
  stateMachine.registerSchema(this, xpath, collector, parentContext);

  // Process startEvent + remaining events in scope
  await stateMachine.process(startEvent);

  for await (const event of iteratorUntilClose(iterator, startDepth)) {
    await stateMachine.process(event);
  }

  return stateMachine.extractResult(collector, this);
}
```

### 3. Context-Based Matching in State Machine

```typescript
interface MatchContext {
  // Current element that owns this schema
  contextElement?: StartElementEvent;
  contextDepth: number;

  // Parent context for nested structures
  parentContext?: MatchContext;
}

class XPathMatcher {
  matchesInContext(event: StartElementEvent, context: MatchContext): boolean {
    if (this.xpath.startsWith('./')) {
      // Relative path - match against context depth
      const relativePath = this.xpath.slice(2);
      return this.matchRelative(event, relativePath, context);
    } else if (this.xpath.startsWith('//')) {
      // Descendant - match at any depth below context
      return this.matchDescendant(event, this.xpath.slice(2), context);
    } else {
      // Absolute path or root-relative
      return this.matchAbsolute(event);
    }
  }

  private matchRelative(event: StartElementEvent, path: string, context: MatchContext): boolean {
    // For ./price, match if:
    // 1. We're exactly 1 level below context
    // 2. Element name matches 'price'
    const expectedDepth = context.contextDepth + path.split('/').length;
    return event.depth === expectedDepth && this.matchesPathSegment(event, path);
  }
}
```

### 4. Schema Activation with Context

```typescript
interface SchemaActivation {
  schema: XmlSchemaBase<any, any>;
  xpath: string;
  matcher: XPathMatcher;
  depth: number;
  collector: Collector<any>;

  // Context for relative matching (replaces parentActivation)
  context?: MatchContext;
  fieldName?: string;
}

// When object activates, create context for its fields
onSchemaActivated(activation: SchemaActivation, event: StartElementEvent) {
  if (schemaType === 'XmlObjectSchema') {
    const objectContext: MatchContext = {
      contextElement: event,
      contextDepth: this.currentDepth,
      parentContext: activation.context
    };

    // Register each field with this context
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      const xpath = extractXPath(fieldSchema);
      const childCollector = createCollector(fieldSchema);

      this.registerSchema(
        fieldSchema,
        xpath,  // Keep as-is (./price, ./name, etc.)
        childCollector,
        objectContext,  // Pass context instead of parent activation
        fieldName
      );
    }
  }
}
```

## Benefits

1. **No Path Resolution Needed**: Keep XPaths in their original form (./price stays ./price)
2. **Natural Scoping**: Each object/array creates a natural scope for its children
3. **Same Logic Everywhere**: FromPosition and parse() use identical State Machine flow
4. **Simpler Debugging**: Context is explicit, not derived from activation chains
5. **Better Performance**: No string concatenation to build absolute paths

## Implementation Steps

1. Add `MatchContext` interface to State Machine
2. Update `XPathMatcher` to support context-based matching
3. Modify `registerSchema` to accept `context` instead of `parentActivation`
4. Update `onSchemaActivated` to create and pass contexts
5. Simplify `parseObjectFromPosition` to just feed events to State Machine
6. Remove `resolveXPath` methods (no longer needed)

## Example Flow

```xml
<book>
  <title>Sample</title>
  <price>19.99</price>
</book>
```

```typescript
const bookSchema = x.object({
  title: x.string().xpath('./title'),
  price: x.number().xpath('./price')
});
```

**Event Processing:**
1. `<book>` START → Object activates, creates context (depth=1)
2. Registers `title` field with xpath=`./title`, context={depth:1}
3. Registers `price` field with xpath=`./price`, context={depth:1}
4. `<title>` START (depth=2) → Matcher checks: `./title` from context depth 1 → expects depth 2, name='title' → MATCH ✓
5. Collect text "Sample"
6. `<price>` START (depth=2) → Same logic → MATCH ✓
7. Collect text "19.99", parse as number

No path concatenation, no absolute paths, pure context-based evaluation!
