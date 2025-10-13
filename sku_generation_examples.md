# SKU Generation Examples

## New Intelligent SKU Generation Logic

The new system uses multiple strategies to generate minimal, unique SKUs:

### Strategy 1: Increment Last Character
- **"ABC12"** → **"ABC13"** (increment last digit)
- **"ABC19"** → **"ABC11"** (9 becomes 1, add new digit)
- **"ABCZ"** → **"ABC1"** (Z becomes 1)
- **"ABC"** → **"ABD"** (increment last letter)

### Strategy 2: Add Single Digit
- **"PRODUCT"** → **"PRODUCT1"** (if increment fails)
- **"ITEM"** → **"ITEM1"** (if increment fails)

### Strategy 3: Add Single Letter
- **"SKU123"** → **"SKU123A"** (if digit addition fails)
- **"TEST"** → **"TESTA"** (if increment fails)

### Fallback: Small Random Suffix
- Only used if all strategies fail
- Adds 2-3 character random suffix (e.g., "AB", "XY")

## Examples of SKU Progression

### Numeric Examples:
- Original: **"12"** → Duplicate: **"13"**
- Original: **"19"** → Duplicate: **"11"**
- Original: **"99"** → Duplicate: **"91"**

### Alphabetic Examples:
- Original: **"AB"** → Duplicate: **"AC"**
- Original: **"AZ"** → Duplicate: **"A1"**
- Original: **"ZZ"** → Duplicate: **"Z1"**

### Mixed Examples:
- Original: **"ABC12"** → Duplicate: **"ABC13"**
- Original: **"ITEM9"** → Duplicate: **"ITEM1"**
- Original: **"PRODZ"** → Duplicate: **"PROD1"**

### No SKU Examples:
- Original: **""** (empty) → Duplicate: **null**
- Original: **null** → Duplicate: **null**

## Benefits:
1. **Minimal changes** - Only 1 character difference when possible
2. **Intelligent progression** - Follows logical patterns
3. **Unique guarantee** - Always generates unique SKU
4. **Short suffixes** - Maximum 4 characters total for fallback
5. **Pattern recognition** - Understands numeric vs alphabetic patterns
