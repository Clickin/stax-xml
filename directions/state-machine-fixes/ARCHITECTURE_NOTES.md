# Architecture Notes - State Machine Implementation

**Purpose**: Deep understanding of the State Machine architecture for debugging and maintenance.

---

## 🏗️ Core Architecture

### The Event-Driven State Machine

The State Machine operates on a **register-activate-collect-deactivate** cycle:

```
┌─────────────────────────────────────────────────────────────┐
│                    State Machine Lifecycle                   │
└─────────────────────────────────────────────────────────────┘

1. REGISTRATION (Setup Phase)
   ┌──────────────────────────────────────────────┐
   │ stateMachine.registerSchema(                 │
   │   schema: XmlArraySchema,                    │
   │   xpath: "//item",                           │
   │   collector: ArrayCollector,                 │
   │   context: undefined                         │
   │ )                                            │
   │                                              │
   │ Creates SchemaActivation:                    │
   │ {                                            │
   │   schema,                                    │
   │   xpath,                                     │
   │   matcher: new XPathMatcher(xpath),          │
   │   depth: -1,  ← Inactive                     │
   │   collector,                                 │
   │   context                                    │
   │ }                                            │
   └──────────────────────────────────────────────┘
                      ↓

2. EVENT PROCESSING (Runtime)
   ┌──────────────────────────────────────────────┐
   │ for each event from parser:                  │
   │                                              │
   │   processEventSync(event)                    │
   │   ├─ if START_ELEMENT:                       │
   │   │  ├─ currentDepth++                       │
   │   │  ├─ matcher.onStartElement(event)        │
   │   │  └─ for each activation:                 │
   │   │     ├─ matchesInContext(event)?          │
   │   │     │  YES → ACTIVATE                    │
   │   │     │  NO  → Skip                        │
   │   │     └─ onSchemaActivatedSync()           │
   │   │                                          │
   │   ├─ if END_ELEMENT:                         │
   │   │  ├─ for each activation:                 │
   │   │  │  └─ if depth matches:                 │
   │   │  │     ├─ DEACTIVATE                     │
   │   │  │     └─ onSchemaDeactivatedSync()      │
   │   │  └─ currentDepth--                       │
   │   │                                          │
   │   └─ if CHARACTERS/CDATA:                    │
   │      └─ onSchemaCollectText()                │
   └──────────────────────────────────────────────┘
                      ↓

3. ACTIVATION (Dynamic Registration)
   ┌──────────────────────────────────────────────┐
   │ onSchemaActivatedSync(activation, event)     │
   │                                              │
   │ Switch on schema type:                       │
   │                                              │
   │ ┌─ XmlArraySchema ─────────────────────┐    │
   │ │ 1. Get element schema                 │    │
   │ │ 2. Determine element type:            │    │
   │ │    • XmlObjectSchema → Register       │    │
   │ │      all object fields with context   │    │
   │ │    • XmlArraySchema → Register        │    │
   │ │      nested array with context        │    │
   │ │    • Simple → Create text buffer      │    │
   │ │ 3. Create itemCollector               │    │
   │ │ 4. Set arrayCollector.currentItem     │    │
   │ └───────────────────────────────────────┘    │
   │                                              │
   │ ┌─ XmlObjectSchema ────────────────────┐    │
   │ │ 1. Get shape (unwrapped)              │    │
   │ │ 2. For each field:                    │    │
   │ │    • Create collector                 │    │
   │ │    • Register with context            │    │
   │ │    • Check for attributes:            │    │
   │ │      If xpath is ./@attr:             │    │
   │ │        Extract immediately!           │    │
   │ │ 3. Store in objectCollector.fields    │    │
   │ └───────────────────────────────────────┘    │
   │                                              │
   │ ┌─ XmlStringSchema / XmlNumberSchema ──┐    │
   │ │ • Reset buffer                        │    │
   │ │ • Start collecting text               │    │
   │ └───────────────────────────────────────┘    │
   └──────────────────────────────────────────────┘
                      ↓

4. TEXT COLLECTION
   ┌──────────────────────────────────────────────┐
   │ onSchemaCollectText(activation, text)        │
   │                                              │
   │ If collector is string/number:               │
   │   collector.buffer += text                   │
   │                                              │
   │ If collector is array with currentItem:      │
   │   currentItem.buffer += text                 │
   └──────────────────────────────────────────────┘
                      ↓

5. DEACTIVATION (Result Building)
   ┌──────────────────────────────────────────────┐
   │ onSchemaDeactivatedSync(activation)          │
   │                                              │
   │ ┌─ XmlArraySchema ─────────────────────┐    │
   │ │ 1. Get currentItem                    │    │
   │ │ 2. Based on element type:             │    │
   │ │    • Object → extractObjectFromCol... │    │
   │ │    • Array → use items directly       │    │
   │ │    • Simple → use buffer.trim()       │    │
   │ │ 3. Push to arrayCollector.items       │    │
   │ │ 4. Clear currentItem                  │    │
   │ └───────────────────────────────────────┘    │
   │                                              │
   │ ┌─ XmlStringSchema ────────────────────┐    │
   │ │ collector.value = buffer.trim()       │    │
   │ └───────────────────────────────────────┘    │
   │                                              │
   │ ┌─ XmlNumberSchema ────────────────────┐    │
   │ │ collector.value = parseFloat(buffer)  │    │
   │ └───────────────────────────────────────┘    │
   └──────────────────────────────────────────────┘
                      ↓

6. EXTRACTION (Finalization)
   ┌──────────────────────────────────────────────┐
   │ extractValueFromCollector(collector, schema) │
   │                                              │
   │ • Apply type conversions                     │
   │ • Apply transforms (TODO!)                   │
   │ • Handle optional schemas                    │
   │ • Return final value                         │
   └──────────────────────────────────────────────┘
```

---

## 🎯 Context-Based Matching

### Understanding Match Context

```typescript
interface MatchContext {
  contextElement: StartElementEvent;  // The parent element
  contextDepth: number;                // Depth of parent
  parentContext?: MatchContext;        // Nested contexts
  contextXPath?: string;               // For debugging
}
```

### XPath Resolution Examples

#### Example 1: Simple Object Fields

```xml
<item sku="ABC">
  <name>Phone</name>
  <price>99</price>
</item>
```

```typescript
// When <item> activates (depth=2):
const itemContext = {
  contextElement: <item> event,
  contextDepth: 2,
  parentContext: undefined
};

// Register fields:
registerSchema(nameSchema, "./name", collector, itemContext)
registerSchema(priceSchema, "./price", collector, itemContext)

// When <name> event comes (depth=3):
matchesInContext(<name>, nameActivation):
  xpath = "./name"
  relativePath = "name"
  expectedDepth = itemContext.contextDepth + 1 = 3 ✓
  eventName = "name" ✓
  → MATCH! Activate nameSchema
```

#### Example 2: Nested Attributes

```xml
<item>
  <price currency="USD">99</price>
</item>
```

```typescript
// Schema: x.string().xpath('./price/@currency')

// When <item> activates:
registerSchema(currencySchema, "./price/@currency", collector, itemContext)

// When <price> event comes (depth=3):
matchesInContext(<price>, currencyActivation):
  xpath = "./price/@currency"
  relativePath = "price/@currency"
  pathSegments = ["price", "@currency"]

  // Check for element/@attr pattern
  lastSegment = "@currency" → startsWith('@') ✓
  expectedDepth = contextDepth + (2 - 1) = 3 ✓
  elementName = "price" ✓
  → MATCH! Activate currencySchema

// In onSchemaActivatedSync:
isAttributeSelector() → YES
getAttribute() → "currency"
Extract from event.attributes["currency"] → "USD"
Store in collector.value
Immediately deactivate (depth = -1)
```

#### Example 3: Array of Objects

```xml
<catalog>
  <item><name>A</name></item>
  <item><name>B</name></item>
</catalog>
```

```typescript
// Schema: x.object({ items: x.array(x.object({ name: x.string() }), '//item') })

// 1. Register root array
registerSchema(arraySchema, '//item', arrayCollector, undefined)

// 2. When first <item> activates (depth=2):
onSchemaActivatedSync(arrayActivation, <item> event):
  schemaType = 'XmlArraySchema'
  elementType = 'XmlObjectSchema'

  // Create item context
  itemContext = {
    contextElement: <item>,
    contextDepth: 2,
    parentContext: undefined
  }

  // Register object fields
  registerSchema(nameSchema, './name', collector, itemContext)

  // Store in currentItem
  arrayCollector.currentItem = itemCollector

// 3. When <name> activates (depth=3):
// ... collects "A" ...

// 4. When </item> closes (depth=2):
onSchemaDeactivatedSync(arrayActivation):
  itemObject = extractObjectFromCollector(currentItem)
  → { name: "A" }
  arrayCollector.items.push(itemObject)
  currentItem = undefined

// 5. Repeat for second <item> → { name: "B" }

// 6. Final result:
arrayCollector.items = [{ name: "A" }, { name: "B" }]
```

---

## 🔍 Key Implementation Details

### Schema Unwrapping

**Why**: Users can write `x.string().transform().optional().xpath()`.
The actual schema is deeply nested inside wrapper objects.

**Solution**: `unwrapSchema()` recursively unwraps Transform/Optional layers.

```typescript
// User's schema chain:
XmlTransformSchema {
  transformFn: item => ({ ...item, total: ... }),
  schema: XmlObjectSchema {
    shape: { ... }
  }
}

// getSchemaType() returns:
unwrapSchema(userSchema).constructor.name
→ "XmlObjectSchema"  // Not "XmlTransformSchema"!

// extractObjectFromCollector() accesses:
unwrapSchema(schema).shape
→ { sku: StringSchema, ... }
```

### Attribute Immediate Extraction

**Why**: Attributes are part of START_ELEMENT event, not separate events.
If we wait for activation, attributes are already passed.

**Solution**: When registering object fields, check if XPath is an attribute selector.
If yes, extract immediately from current event.

```typescript
// In onSchemaActivatedSync - XmlObjectSchema case:
for (const [fieldName, fieldSchema] of Object.entries(shape)) {
  // ... register schema ...

  // NEW: Immediate attribute extraction
  if (xpath.startsWith('./@') || xpath.startsWith('@')) {
    const attrName = xpath.slice(xpath.lastIndexOf('@') + 1);
    if (event.attributes && attrName in event.attributes) {
      childCollector.value = event.attributes[attrName];
    }
  }
}
```

This happens at TWO places:
1. XmlArraySchema → XmlObjectSchema (line ~390)
2. XmlObjectSchema (line ~475)

### Depth Tracking

**Critical**: Depth is THE key to activation/deactivation.

```
<root>           depth = 1
  <item>         depth = 2  ← Array activates here
    <name>A      depth = 3  ← Name activates here
    </name>      depth = 3  ← Name deactivates here
  </item>        depth = 2  ← Array deactivates here
</root>          depth = 1
```

**Rules**:
- `depth = -1`: Schema is inactive
- `depth >= 0`: Schema is active at this depth
- Deactivate when `currentDepth === activation.depth` AND event is END_ELEMENT

---

## 🐛 Common Pitfalls

### Pitfall 1: Forgetting to Unwrap

**Bad**:
```typescript
const shape = (schema as any).shape;
// If schema is XmlTransformSchema, shape is undefined!
```

**Good**:
```typescript
const unwrapped = this.unwrapSchema(schema);
const shape = (unwrapped as any).shape;
```

### Pitfall 2: XPath Matching Without Context

**Bad**:
```typescript
// In matchesInContext
return activation.matcher.matches(event);
// Doesn't consider relative paths!
```

**Good**:
```typescript
if (xpath.startsWith('./')) {
  const expectedDepth = context.contextDepth + pathSegments.length;
  return this.currentDepth === expectedDepth && ...
}
```

### Pitfall 3: Not Cleaning Up Temp Schemas

**Bad**:
```typescript
// Register 6 field schemas for each array item
// After 1000 items → 6000 schemas in memory!
```

**Good** (TODO):
```typescript
activation.isTemporary = true;
// On deactivation:
this.activeSchemas = this.activeSchemas.filter(a => !a.isTemporary);
```

### Pitfall 4: Applying Transforms Too Early

**Bad**:
```typescript
// Apply transform to field values individually
result[fieldName] = transformFn(fieldValue);
```

**Good**:
```typescript
// Build object first, then apply transform
let result = { field1, field2, field3 };
result = transformFn(result);  // Transform has access to all fields
```

---

## 📊 Data Flow Example

### Input XML
```xml
<items>
  <item sku="A1">
    <name>Phone</name>
    <price currency="USD">599</price>
  </item>
</items>
```

### Schema
```typescript
const schema = x.object({
  items: x.array(
    x.object({
      sku: x.string().xpath('./@sku'),
      name: x.string().xpath('./name'),
      price: x.number().xpath('./price'),
      currency: x.string().xpath('./price/@currency')
    }).transform(item => ({
      ...item,
      formatted: `${item.price} ${item.currency}`
    })),
    '//item'
  )
});
```

### Execution Trace

```
1. parseObject() called
   → registerSchema(rootObjectSchema, undefined, rootCollector)

2. START <items> (depth=1)
   → rootObjectSchema activates
   → Register: arraySchema, '//item', arrayCollector

3. START <item sku="A1"> (depth=2)
   → arraySchema activates (matches '//item')
   → elementType = XmlObjectSchema
   → Create itemCollector
   → Register 4 field schemas:
      • skuSchema, './@sku' → IMMEDIATE extract: "A1"
      • nameSchema, './name'
      • priceSchema, './price'
      • currencySchema, './price/@currency'

4. START <name> (depth=3)
   → nameSchema activates (matches './name' at depth 3)
   → Initialize buffer: ""

5. CHARACTERS "Phone"
   → nameCollector.buffer += "Phone"

6. END </name> (depth=3)
   → nameSchema deactivates
   → nameCollector.value = "Phone"

7. START <price currency="USD"> (depth=3)
   → priceSchema activates
   → currencySchema activates (matches './price/@currency')
   → IMMEDIATE extract currency: "USD"
   → Initialize price buffer: ""

8. CHARACTERS "599"
   → priceCollector.buffer += "599"

9. END </price> (depth=3)
   → priceSchema deactivates
   → priceCollector.value = 599
   → currencySchema was already deactivated (immediate)

10. END </item> (depth=2)
    → arraySchema deactivates
    → Extract object from itemCollector:
       { sku: "A1", name: "Phone", price: 599, currency: "USD" }
    → Apply transform:
       { sku: "A1", name: "Phone", price: 599, currency: "USD",
         formatted: "599 USD" }
    → arrayCollector.items.push(result)
    → currentItem = undefined

11. END </items> (depth=1)
    → rootObjectSchema deactivates

12. Extract final result:
    {
      items: [
        {
          sku: "A1",
          name: "Phone",
          price: 599,
          currency: "USD",
          formatted: "599 USD"
        }
      ]
    }
```

---

## 🔧 Debugging Tips

### Enable Detailed Logging

```typescript
// XmlParsingStateMachine.ts, lines 129 and 160
const isDebug = true;

// Add custom logging:
console.log('[DEBUG] Activations:', this.activeSchemas.map(a => ({
  fieldName: a.fieldName,
  xpath: a.xpath,
  depth: a.depth,
  collectorType: a.collector.type
})));
```

### Visualize State Machine State

```typescript
// Add to processEventSync after each event:
if (isDebug && isStartElement(event)) {
  console.log('State after START:', {
    element: event.name,
    depth: this.currentDepth,
    activeCount: this.activeSchemas.filter(a => a.depth !== -1).length,
    totalSchemas: this.activeSchemas.length
  });
}
```

### Track Collector Changes

```typescript
// In onSchemaCollectText:
console.log('[COLLECT]', activation.fieldName, '+=', JSON.stringify(text));

// In onSchemaDeactivatedSync:
console.log('[DEACTIVATE]', activation.fieldName, '→', activation.collector.value);
```

---

## 📚 Related Files

**State Machine Core**:
- `XmlParsingStateMachine.ts`: Main state machine
- `XPathEngine.ts`: XPath matcher

**Integration Points**:
- `XmlParserInternal.ts`: parseArray/parseObject entry points
- `XmlObjectSchema.ts`: _parseFromPosition
- `XmlArraySchema.ts`: _parseFromPosition

**Supporting Types**:
- `types.ts`: ParseOptions, Collector types
- `base.ts`: XmlSchemaBase

---

## 💡 Future Improvements

1. **Performance**: Object pooling for collectors to reduce GC pressure
2. **Memory**: Implement aggressive schema cleanup
3. **Features**: Support for more complex XPath expressions
4. **Developer Experience**: Better error messages with XPath context
5. **Testing**: Property-based testing for XPath matching logic
