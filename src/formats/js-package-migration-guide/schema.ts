import semver from "semver";
import { z } from "zod";
import { inlineMarkdownProblems } from "../../content-builder.ts";

// The official pattern from https://semver.org, without the leading `v`.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** One line of inline Markdown for a table cell, where only inline code is allowed. */
const tableCell = (label: string, maxLength: number) =>
  z
    .string({ error: `${label} is required and must be a string` })
    .min(1, `${label} must not be empty`)
    .max(maxLength, `${label} must be at most ${maxLength} characters`)
    .regex(/[^.]$/, `${label} must not end with a period`)
    .superRefine((cell, ctx) => {
      for (const problem of inlineMarkdownProblems(cell)) {
        ctx.addIssue({ code: "custom", message: `${label} ${problem}` });
      }
    });

const CHANGE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const tableRow = (field: string) =>
  z
    .object({
      id: z
        .string({ error: `each ${field} id is required and must be a string` })
        .max(40, `each ${field} id must be at most 40 characters`)
        .regex(CHANGE_ID, `each ${field} id must be kebab-case, like \`native-enum\``)
        .describe(
          "A kebab-case ID for the change, like `native-enum`, unique across whatsNew and breakingChanges. codeExamples refer to it. Not rendered.",
        ),
      name: tableCell(`each ${field} name`, 50).describe(
        "A short name for the change, like `Zod Mini` or `z.record()`.",
      ),
      description: tableCell(`each ${field} description`, 100).describe(
        "What changed, as a sentence fragment with no trailing period.",
      ),
    })
    .strict();

// An absolute http(s) URL, or a relative path like `./zod-3.0.0.md`, with no
// whitespace so it can't break out of the Markdown link.
const HREF = /^(?:https?:\/\/|\.{0,2}\/)\S+$/;

const API_NAME = /^[^\s`]+$/;

/** An API or module name, rendered as inline code in a heading. */
const apiName = (label: string) =>
  z
    .string({ error: `${label} is required and must be a string` })
    .min(1, `${label} must not be empty`)
    .max(40, `${label} must be at most 40 characters`)
    .regex(API_NAME, `${label} must be bare code with no spaces or backticks, like \`z.enum()\``);

const MAX_REASON_LENGTH = 150;
const MAX_CODE_LINES = 15;

const ReasonSchema = z
  .string({ error: "each codeExamples reason is required and must be a string" })
  .max(MAX_REASON_LENGTH, `each codeExamples reason must be at most ${MAX_REASON_LENGTH} characters`)
  .regex(/\.$/, "each codeExamples reason must end with a period")
  // Code like `z.string().email()` contains periods, so ignore code spans.
  .refine(
    (sentence) => !/[.!?]\s/.test(sentence.replace(/`[^`]*`/g, "code")),
    "each codeExamples reason must be one sentence",
  )
  .superRefine((sentence, ctx) => {
    for (const problem of inlineMarkdownProblems(sentence)) {
      ctx.addIssue({ code: "custom", message: `each codeExamples reason ${problem}` });
    }
  })
  .describe(
    "One sentence explaining why the code changes, like `` `z.enum()` now accepts enum-like objects, so `z.nativeEnum()` is deprecated. ``. Wrap code in backticks and use no other formatting.",
  );

const codeSnippet = (label: string) =>
  z
    .string({ error: `${label} is required and must be a string` })
    .min(1, `${label} must not be empty`)
    .refine((code) => code.split("\n").length <= MAX_CODE_LINES, `${label} must be at most ${MAX_CODE_LINES} lines`)
    .refine((code) => !code.includes("```"), `${label} must not contain \`\`\`: code fences are added for you`)
    .refine((code) => code === code.replace(/^\n+|\s+$/g, ""), `${label} must not start or end with blank lines or spaces`);

const exampleFields = {
  changeId: z
    .string({ error: "each codeExamples changeId is required and must be a string" })
    .describe("The id of the whatsNew or breakingChanges item this example shows."),
  reason: ReasonSchema,
  language: z
    .enum(["ts", "tsx", "js", "jsx"], { error: "each codeExamples language must be one of ts, tsx, js, jsx" })
    .default("ts"),
  before: codeSnippet("each codeExamples before").describe("Code that works on the old version."),
  after: codeSnippet("each codeExamples after").describe("The same code updated for the new version."),
};

const fromTo = {
  from: apiName("each codeExamples from").describe("The old API, like `z.nativeEnum()`."),
  to: apiName("each codeExamples to").describe("The new API, like `z.enum()`."),
};

const ApiSchema = apiName("each codeExamples api").describe("The API this example is about, like `.default()`.");

const CodeExampleSchema = z
  .discriminatedUnion(
    "action",
    [
      z
        .object({ action: z.literal("replace"), ...fromTo, ...exampleFields })
        .strict()
        .describe("A different API does the job now. Renders as \"Replace `from` with `to`\"."),
      z
        .object({ action: z.literal("rename"), ...fromTo, ...exampleFields })
        .strict()
        .describe("Only the name changed. Renders as \"Rename `from` to `to`\"."),
      z
        .object({
          action: z.literal("move"),
          api: ApiSchema,
          fromModule: apiName("each codeExamples fromModule").describe("The old import path, like `zod`."),
          toModule: apiName("each codeExamples toModule").describe("The new import path, like `zod/v4`."),
          ...exampleFields,
        })
        .strict()
        .describe("The import path changed. Renders as \"Import `api` from `toModule`\"."),
      z
        .object({
          action: z.literal("remove"),
          api: ApiSchema,
          ...exampleFields,
          after: exampleFields.after.optional(),
        })
        .strict()
        .describe(
          "The API is gone. Renders as \"Remove `api`\". Omit after if the fix is just deleting the code.",
        ),
      z
        .object({ action: z.literal("update"), api: ApiSchema, ...exampleFields })
        .strict()
        .describe("The API still exists but behaves differently. Renders as \"Update uses of `api`\"."),
    ],
    { error: "each codeExamples action must be one of replace, rename, move, remove, update" },
  )
  .superRefine((example, ctx) => {
    // A malformed name already has its own issue, so don't also report the code.
    const require = (field: "before" | "after", code: string | undefined, name: string, shouldUse: boolean) => {
      if (code === undefined || !API_NAME.test(name) || code.includes(callPrefix(name)) === shouldUse) return;
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: `each codeExamples ${field} must ${shouldUse ? "use" : "not use"} \`${name}\``,
      });
    };

    if (example.before === example.after) {
      ctx.addIssue({ code: "custom", path: ["after"], message: "each codeExamples after must differ from before" });
    }
    switch (example.action) {
      case "replace":
      case "rename":
        require("before", example.before, example.from, true);
        require("after", example.after, example.from, false);
        require("after", example.after, example.to, true);
        break;
      case "move":
        require("before", example.before, example.fromModule, true);
        require("after", example.after, example.toModule, true);
        break;
      case "remove":
        require("before", example.before, example.api, true);
        require("after", example.after, example.api, false);
        break;
      case "update":
        require("before", example.before, example.api, true);
        require("after", example.after, example.api, true);
        break;
    }
  });

/** `z.enum()` matches `z.enum(ColorEnum)`, so drop the empty argument list. */
function callPrefix(name: string): string {
  return name.endsWith("()") ? name.slice(0, -1) : name;
}

const GuideSchema = z
  .object({
    packageName: z
      .string()
      .min(1, "packageName must not be empty")
      .regex(/^\S+$/, "packageName must not contain whitespace")
      .describe("The package as users install it, e.g. `@acme/sdk`."),
    version: z
      .string()
      .regex(SEMVER, "version must be a semantic version like `2.0.0`, with no leading `v`")
      .describe("The version being migrated to, e.g. `2.0.0` or `3.0.0-beta.1`."),
    whatsNew: z
      .array(tableRow("whatsNew"))
      .min(1, "include at least 1 whatsNew item")
      .describe(
        "Improvements in this version, rendered as a table. Each name and description is one line of Markdown: wrap code in backticks, like `z.email()`, and use no other formatting.",
      ),
    breakingChanges: z
      .array(tableRow("breakingChanges"))
      .default([])
      .describe(
        "Changes users must act on when upgrading, rendered as a table in the same style as whatsNew. Omit if there are none.",
      ),
    prerequisites: z
      .object({
        minimumVersion: z
          .object({
            version: z
              .string()
              .regex(SEMVER, "prerequisites.minimumVersion.version must be a semantic version like `1.0.0`, with no leading `v`")
              .describe("The oldest version users can upgrade from directly, e.g. `3.0.0`."),
            guideUrl: z
              .string()
              .regex(
                HREF,
                "prerequisites.minimumVersion.guideUrl must be an http(s) URL or a relative path like `./guide.md`, with no spaces",
              )
              .optional()
              .describe("A link to the migration guide for `version`, if there is one. Omit it rather than guess."),
          })
          .strict()
          .optional()
          .describe("Set when users on older versions must upgrade to this version first."),
      })
      .strict()
      .default({})
      .describe("What users need before upgrading. Omit if there is nothing."),
    codeExamples: z
      .array(CodeExampleSchema)
      .max(12, "include at most 12 codeExamples")
      .default([])
      .describe(
        "Before-and-after code for changes users must make or should adopt, each rendered under a heading built from `action`. Choose the most specific action. Include an example only when code actually changes.",
      ),
  })
  .strict();

export const JsPackageMigrationGuideSchema = GuideSchema.superRefine((data, ctx) => {
  checkMinimumVersion(data, ctx);
  checkChangeIds(data, ctx);
});

type Guide = z.output<typeof GuideSchema>;

function checkMinimumVersion(data: Guide, ctx: z.RefinementCtx) {
  const minimum = data.prerequisites.minimumVersion?.version;
  if (!minimum || !SEMVER.test(minimum) || !SEMVER.test(data.version)) return;
  if (!semver.lt(minimum, data.version)) {
    ctx.addIssue({
      code: "custom",
      path: ["prerequisites", "minimumVersion", "version"],
      message: `prerequisites.minimumVersion.version must be below the target version ${data.version}, got \`${minimum}\``,
    });
  }
}

/** IDs are unique across both tables, and every codeExamples changeId names one. */
function checkChangeIds(data: Guide, ctx: z.RefinementCtx) {
  const ids = new Set<string>();
  for (const field of ["whatsNew", "breakingChanges"] as const) {
    data[field].forEach((change, index) => {
      if (ids.has(change.id)) {
        ctx.addIssue({
          code: "custom",
          path: [field, index, "id"],
          message: `change id \`${change.id}\` is used more than once across whatsNew and breakingChanges`,
        });
      }
      ids.add(change.id);
    });
  }

  data.codeExamples.forEach((example, index) => {
    if (ids.has(example.changeId)) return;
    ctx.addIssue({
      code: "custom",
      path: ["codeExamples", index, "changeId"],
      message: `codeExamples changeId \`${example.changeId}\` doesn't match any change; use one of: ${[...ids].join(", ")}`,
    });
  });
}

/** What Claude writes. */
export type JsPackageMigrationGuideInput = z.input<typeof JsPackageMigrationGuideSchema>;
/** What the renderer receives, after defaults are applied. */
export type JsPackageMigrationGuide = z.output<typeof JsPackageMigrationGuideSchema>;
