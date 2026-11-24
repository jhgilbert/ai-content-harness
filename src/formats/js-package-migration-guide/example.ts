import type { JsPackageMigrationGuideInput } from "./schema.ts";

export const example: JsPackageMigrationGuideInput = {
  packageName: "zod",
  version: "4.0.0",
  whatsNew: [
    {
      id: "faster-parsing", name: "Faster parsing",
      description: "About 14x faster for strings, 7x for arrays, and 6.5x for objects",
    },
    {
      id: "faster-type-checking", name: "Faster type checking",
      description: "Up to 100x fewer TypeScript type instantiations, so large schemas compile faster",
    },
    { id: "zod-mini", name: "Zod Mini", description: "A tree-shakable functional API published at `zod/mini`" },
    { id: "json-schema", name: "JSON Schema conversion", description: "Built-in conversion with `z.toJSONSchema()`" },
    {
      id: "metadata", name: "Metadata",
      description: "Registries for attaching descriptions and other data to schemas with `.meta()`",
    },
    {
      id: "top-level-string-formats", name: "Top-level string formats",
      description: "`z.email()`, `z.uuid()`, `z.iso.datetime()`, and more",
    },
    { id: "pretty-errors", name: "Pretty errors", description: "Readable error output with `z.prettifyError()`" },
  ],
  breakingChanges: [
    {
      id: "message-param", name: "`message` parameter",
      description: "Deprecated in favor of a unified `error` parameter",
    },
    {
      id: "error-type-params", name: "`invalid_type_error`, `required_error`",
      description: "Removed in favor of the `error` parameter",
    },
    {
      id: "error-formatting", name: "Error formatting",
      description: "`error.format()` and `error.flatten()` are deprecated in favor of `z.treeifyError()`",
    },
    {
      id: "string-format-methods", name: "String format methods",
      description: "Methods like `z.string().email()` are deprecated in favor of `z.email()`",
    },
    {
      id: "default", name: "`.default()`",
      description: "Now short-circuits on `undefined`, and its value must match the output type",
    },
    { id: "record", name: "`z.record()`", description: "Requires both a key schema and a value schema" },
    {
      id: "number-schemas", name: "Number schemas",
      description: "Infinite values are rejected, and `.int()` accepts only safe integers",
    },
    {
      id: "native-enum", name: "`z.nativeEnum()`",
      description: "Deprecated because `z.enum()` now accepts enum-like objects",
    },
    { id: "function", name: "`z.function()`", description: "No longer returns a Zod schema" },
    { id: "deep-partial", name: "`.deepPartial()`", description: "Removed with no direct replacement" },
  ],
  prerequisites: {
    minimumVersion: { version: "3.25.0", guideUrl: "./zod-3.25.0.md" },
  },
  codeExamples: [
    {
      changeId: "string-format-methods",
      action: "replace",
      from: "z.string().email()",
      to: "z.email()",
      reason: "String format methods on `z.string()` are deprecated in favor of top-level functions.",
      before: "const Email = z.string().email();",
      after: "const Email = z.email();",
    },
    {
      changeId: "native-enum",
      action: "replace",
      from: "z.nativeEnum()",
      to: "z.enum()",
      reason: "`z.enum()` now accepts enum-like objects, so `z.nativeEnum()` is deprecated.",
      before: "const Color = z.nativeEnum(ColorEnum);",
      after: "const Color = z.enum(ColorEnum);",
    },
    {
      changeId: "error-type-params",
      action: "replace",
      from: "invalid_type_error",
      to: "error",
      reason: "The unified `error` parameter replaces `invalid_type_error`, `required_error`, and `message`.",
      before: 'const Name = z.string({ invalid_type_error: "Name must be a string" });',
      after: 'const Name = z.string({ error: "Name must be a string" });',
    },
    {
      changeId: "default",
      action: "update",
      api: ".default()",
      reason: "`.default()` now skips parsing, so its value must match the output type.",
      before: 'const Length = z.string().transform((s) => s.length).default("abc");',
      after: "const Length = z.string().transform((s) => s.length).default(3);",
    },
    {
      changeId: "deep-partial",
      action: "remove",
      api: ".deepPartial()",
      reason: "There is no direct replacement, so call `.partial()` on each nested object that should be optional.",
      before: "const Draft = User.deepPartial();",
      after: "const Draft = User.extend({ address: Address.partial() }).partial();",
    },
  ],
};
