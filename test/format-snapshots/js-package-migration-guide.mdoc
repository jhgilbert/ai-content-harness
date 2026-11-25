# Migrate to `zod@4.0.0`

## Overview

This guide contains instructions for upgrading to `zod@4.0.0`.

## What's new in `4.0.0`

{% table %}
- Feature
- Description
---
- Faster parsing
- About 14x faster for strings, 7x for arrays, and 6.5x for objects
---
- Faster type checking
- Up to 100x fewer TypeScript type instantiations, so large schemas compile faster
---
- Zod Mini
- A tree-shakable functional API published at `zod/mini`
---
- JSON Schema conversion
- Built-in conversion with `z.toJSONSchema()`
---
- Metadata
- Registries for attaching descriptions and other data to schemas with `.meta()`
---
- Top-level string formats
- `z.email()`, `z.uuid()`, `z.iso.datetime()`, and more
---
- Pretty errors
- Readable error output with `z.prettifyError()`
{% /table %}

## Breaking changes in `4.0.0`

{% table %}
- Change
- Description
---
- `message` parameter
- Deprecated in favor of a unified `error` parameter
---
- `invalid_type_error`, `required_error`
- Removed in favor of the `error` parameter
---
- Error formatting
- `error.format()` and `error.flatten()` are deprecated in favor of `z.treeifyError()`
---
- String format methods
- Methods like `z.string().email()` are deprecated in favor of `z.email()`
---
- `.default()`
- Now short-circuits on `undefined`, and its value must match the output type
---
- `z.record()`
- Requires both a key schema and a value schema
---
- Number schemas
- Infinite values are rejected, and `.int()` accepts only safe integers
---
- `z.nativeEnum()`
- Deprecated because `z.enum()` now accepts enum-like objects
---
- `z.function()`
- No longer returns a Zod schema
---
- `.deepPartial()`
- Removed with no direct replacement
{% /table %}

## Upgrade instructions

### Prerequisites

You must be on `zod@3.25.0` or newer. To upgrade to `zod@3.25.0` first, see the [migration guide for `zod@3.25.0`](./zod-3.25.0.md).

### Replace `z.string().email()` with `z.email()`

String format methods on `z.string()` are deprecated in favor of top-level functions.

```ts
// Before
const Email = z.string().email();

// After
const Email = z.email();
```

### Replace `z.nativeEnum()` with `z.enum()`

`z.enum()` now accepts enum-like objects, so `z.nativeEnum()` is deprecated.

```ts
// Before
const Color = z.nativeEnum(ColorEnum);

// After
const Color = z.enum(ColorEnum);
```

### Replace `invalid_type_error` with `error`

The unified `error` parameter replaces `invalid_type_error`, `required_error`, and `message`.

```ts
// Before
const Name = z.string({ invalid_type_error: "Name must be a string" });

// After
const Name = z.string({ error: "Name must be a string" });
```

### Update uses of `.default()`

`.default()` now skips parsing, so its value must match the output type.

```ts
// Before
const Length = z.string().transform((s) => s.length).default("abc");

// After
const Length = z.string().transform((s) => s.length).default(3);
```

### Remove `.deepPartial()`

There is no direct replacement, so call `.partial()` on each nested object that should be optional.

```ts
// Before
const Draft = User.deepPartial();

// After
const Draft = User.extend({ address: Address.partial() }).partial();
```
