import { describe, expect, it } from "vitest";
import type { OutputType } from "../src/define-format.ts";
import {
  formats,
  getFormat,
  jiraCardDescription,
  jsPackageMigrationGuide,
  linkedInPost,
  presidentDescription,
} from "../src/formats/index.ts";
import { example } from "../src/formats/jira-card-description/example.ts";
import { example as migrationExample } from "../src/formats/js-package-migration-guide/example.ts";
import { example as linkedInExample } from "../src/formats/linked-in-post/example.ts";
import { example as presidentExample } from "../src/formats/president-description/example.ts";

const SNAPSHOT_EXTENSIONS: Record<OutputType, string> = {
  plaintext: "txt",
  markdown: "md",
  html: "html",
  markdoc: "mdoc",
  json: "json",
};

describe("registered formats", () => {
  const withExamples = formats.filter((format) => format.getInfo().example !== undefined);

  it.each(withExamples.map((format) => [format.name, format] as const))(
    "%s has a valid example",
    (_name, format) => {
      expect(format.validateJson(format.getInfo().example)).toMatchObject({ success: true });
    },
  );

  // Review changes to these files like code. Update them with `npm test -- -u`.
  it.each(withExamples.map((format) => [format.name, format] as const))(
    "%s renders its example to the snapshot",
    async (name, format) => {
      const { example, outputType } = format.getInfo();
      const extension = SNAPSHOT_EXTENSIONS[outputType];
      await expect(format.jsonToString(example)).toMatchFileSnapshot(
        `./format-snapshots/${name}.${extension}`,
      );
    },
  );

  it("names are unique", () => {
    const names = formats.map((format) => format.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("getFormat lists available formats for an unknown name", () => {
    expect(() => getFormat("nope")).toThrow(/jira-card-description/);
  });
});

describe("jira-card-description", () => {
  it("rejects too many open questions", () => {
    const result = jiraCardDescription.validateJson({
      ...example,
      openQuestions: ["A?", "B?", "C?", "D?", "E?"],
    });
    expect(result).toMatchObject({
      success: false,
      issues: [{ path: "openQuestions", message: "include at most 4 open questions" }],
    });
  });

  it("omits the open questions section when there are none", () => {
    const { openQuestions: _omitted, ...rest } = example;
    expect(jiraCardDescription.jsonToString(rest)).not.toContain("Open questions");
  });
});

describe("js-package-migration-guide", () => {
  it.each(["2.0.0", "3.0.0-beta.1", "1.4.2+build.7"])("accepts version %s", (version) => {
    const prerequisites = {};
    expect(jsPackageMigrationGuide.validateJson({ ...migrationExample, version, prerequisites })).toMatchObject({
      success: true,
    });
  });

  it.each(["v2.0.0", "2.0", "02.0.0"])("rejects version %s", (version) => {
    expect(jsPackageMigrationGuide.validateJson({ ...migrationExample, version })).toMatchObject({
      success: false,
      issues: [{ path: "version" }],
    });
  });

  it("requires at least one whatsNew item", () => {
    expect(jsPackageMigrationGuide.validateJson({ ...migrationExample, whatsNew: [] })).toMatchObject({
      success: false,
      issues: [{ path: "whatsNew", message: "include at least 1 whatsNew item" }],
    });
  });

  it("rejects table cells that end with a period", () => {
    expect(
      jsPackageMigrationGuide.validateJson({
        ...migrationExample,
        breakingChanges: [{ id: "node-18", name: "Node.js 18", description: "Support was dropped." }],
        codeExamples: [],
      }),
    ).toMatchObject({
      success: false,
      issues: [{ path: "breakingChanges[0].description" }],
    });
  });

  it("allows a pipe in a table cell", () => {
    const guide = {
      ...migrationExample,
      whatsNew: [{ id: "unions", name: "Unions", description: "Works with `string | number` types" }],
    };
    expect(jsPackageMigrationGuide.validateJson(guide)).toMatchObject({ success: true });
    expect(jsPackageMigrationGuide.jsonToString(guide)).toContain("- Works with `string | number` types");
  });

  it("names a missing table cell", () => {
    expect(
      jsPackageMigrationGuide.validateJson({ ...migrationExample, whatsNew: [{ id: "zod-mini", name: "Zod Mini" }] }),
    ).toMatchObject({
      success: false,
      issues: [
        { path: "whatsNew[0].description", message: "each whatsNew description is required and must be a string" },
      ],
    });
  });

  it.each([
    ["name", 50],
    ["description", 100],
  ] as const)("limits each %s to %i characters", (cell, maxLength) => {
    const row = (length: number) => ({
      id: "row",
      name: "Name",
      description: "Description",
      [cell]: "a".repeat(length),
    });
    expect(jsPackageMigrationGuide.validateJson({ ...migrationExample, whatsNew: [row(maxLength)] })).toMatchObject({
      success: true,
    });
    expect(
      jsPackageMigrationGuide.validateJson({ ...migrationExample, whatsNew: [row(maxLength + 1)] }),
    ).toMatchObject({ success: false, issues: [{ path: `whatsNew[0].${cell}` }] });
  });

  it.each(["https://zod.dev/v3", "./zod-3.0.0.md", "../guides/zod-3.md", "/guides/zod-3"])(
    "accepts guideUrl %s",
    (guideUrl) => {
      const prerequisites = { minimumVersion: { version: "3.0.0", guideUrl } };
      expect(jsPackageMigrationGuide.validateJson({ ...migrationExample, prerequisites })).toMatchObject({
        success: true,
      });
    },
  );

  it.each(["javascript:alert(1)", "zod-3.0.0.md", "./zod 3.md", "ftp://example.com/guide"])(
    "rejects guideUrl %s",
    (guideUrl) => {
      const prerequisites = { minimumVersion: { version: "3.0.0", guideUrl } };
      expect(jsPackageMigrationGuide.validateJson({ ...migrationExample, prerequisites })).toMatchObject({
        success: false,
        issues: [{ path: "prerequisites.minimumVersion.guideUrl" }],
      });
    },
  );

  it.each(["4.0.0", "4.1.0"])("rejects a minimum version of %s for a 4.0.0 guide", (version) => {
    const result = jsPackageMigrationGuide.validateJson({
      ...migrationExample,
      prerequisites: { minimumVersion: { version } },
    });
    expect(result).toMatchObject({ success: false, issues: [{ path: "prerequisites.minimumVersion.version" }] });
    expect(result.success === false && result.feedback).toMatch(/below the target version 4\.0\.0/);
  });

  it("leaves out the guide sentence without a guideUrl", () => {
    const markdown = jsPackageMigrationGuide.jsonToString({
      ...migrationExample,
      prerequisites: { minimumVersion: { version: "3.0.0" } },
    });
    expect(markdown).toContain("You must be on `zod@3.0.0` or newer.\n");
    expect(markdown).not.toContain("migration guide for");
  });

  it("omits the prerequisites section when there are none", () => {
    const { prerequisites: _omitted, ...rest } = migrationExample;
    const markdown = jsPackageMigrationGuide.jsonToString(rest);
    expect(markdown).not.toContain("Prerequisites");
    expect(markdown).toContain("### Replace `z.nativeEnum()` with `z.enum()`");
  });

  it("omits the breaking changes section when there are none", () => {
    const { breakingChanges: _omitted, codeExamples: _examples, ...rest } = migrationExample;
    expect(jsPackageMigrationGuide.jsonToString(rest)).not.toContain("Breaking changes");
  });

  it("omits the upgrade instructions section when there is nothing to show", () => {
    const { prerequisites: _prerequisites, codeExamples: _examples, ...rest } = migrationExample;
    expect(jsPackageMigrationGuide.jsonToString(rest)).not.toContain("Upgrade instructions");
  });
});

describe("js-package-migration-guide change IDs", () => {
  const nativeEnum = migrationExample.codeExamples![1]!;

  it("lets a code example refer to a whatsNew change", () => {
    const guide = {
      ...migrationExample,
      codeExamples: [{ ...nativeEnum, changeId: "top-level-string-formats" }],
    };
    expect(jsPackageMigrationGuide.validateJson(guide)).toMatchObject({ success: true });
  });

  it("rejects a changeId that matches no change, and lists the valid ones", () => {
    const result = jsPackageMigrationGuide.validateJson({
      ...migrationExample,
      codeExamples: [{ ...nativeEnum, changeId: "nativeEnum" }],
    });
    expect(result).toMatchObject({ success: false, issues: [{ path: "codeExamples[0].changeId" }] });
    expect(result.success === false && result.feedback).toMatch(/doesn't match any change; use one of: .*native-enum/);
  });

  it("rejects an id used in both tables", () => {
    const result = jsPackageMigrationGuide.validateJson({
      ...migrationExample,
      whatsNew: [{ id: "native-enum", name: "Enums", description: "Enum-like objects work with `z.enum()`" }],
    });
    expect(result).toMatchObject({
      success: false,
      issues: [{ path: "breakingChanges[7].id", message: expect.stringMatching(/used more than once/) }],
    });
  });

  it.each(["Native-Enum", "native_enum", "native enum", "-native"])("rejects id %s", (id) => {
    const whatsNew = [{ ...migrationExample.whatsNew[0]!, id }];
    expect(jsPackageMigrationGuide.validateJson({ ...migrationExample, whatsNew })).toMatchObject({
      success: false,
      issues: [{ path: "whatsNew[0].id" }],
    });
  });
});

describe("js-package-migration-guide code examples", () => {
  const shared = {
    changeId: "native-enum",
    reason: "`z.enum()` now accepts enum-like objects, so `z.nativeEnum()` is deprecated.",
    before: "const Color = z.nativeEnum(ColorEnum);",
    after: "const Color = z.enum(ColorEnum);",
  };
  const replace = { ...shared, action: "replace", from: "z.nativeEnum()", to: "z.enum()" };
  const update = { ...shared, action: "update", api: "z.nativeEnum()", after: "const Color = z.nativeEnum(Other);" };
  const render = (example: object) =>
    jsPackageMigrationGuide.jsonToString({ ...migrationExample, codeExamples: [example] });
  const validate = (example: object) =>
    jsPackageMigrationGuide.validateJson({ ...migrationExample, codeExamples: [example] });

  it.each([
    [replace, "### Replace `z.nativeEnum()` with `z.enum()`"],
    [{ ...replace, action: "rename" }, "### Rename `z.nativeEnum()` to `z.enum()`"],
    [
      {
        ...shared,
        action: "move",
        api: "z",
        fromModule: "zod",
        toModule: "zod/v4",
        before: 'import { z } from "zod";',
        after: 'import { z } from "zod/v4";',
      },
      "### Import `z` from `zod/v4`",
    ],
    [{ ...shared, action: "remove", api: "z.nativeEnum()" }, "### Remove `z.nativeEnum()`"],
    [update, "### Update uses of `z.nativeEnum()`"],
  ])("builds the heading for %o", (example, expected) => {
    expect(render(example)).toContain(`${expected}\n`);
  });

  it("renders before and after in one fenced block", () => {
    expect(render(replace)).toContain(
      "```ts\n// Before\nconst Color = z.nativeEnum(ColorEnum);\n\n// After\nconst Color = z.enum(ColorEnum);\n```",
    );
  });

  it("renders a removal without after as plain code", () => {
    const { after: _omitted, ...rest } = shared;
    const markdown = render({ ...rest, action: "remove", api: "z.nativeEnum()" });
    expect(markdown).toContain("```ts\nconst Color = z.nativeEnum(ColorEnum);\n```");
  });

  it.each([
    ["an unknown action", { action: "deprecate" }, "action", /must be one of replace, rename, move, remove, update/],
    ["a reason with two sentences", { reason: "It changed. Use the new one." }, "reason", /one sentence/],
    ["a reason with no period", { reason: "It changed" }, "reason", /end with a period/],
    ["a reason with bold text", { reason: "It **changed**." }, "reason", /must not use strong formatting/],
    ["a reason that is too long", { reason: `${"a".repeat(150)}.` }, "reason", /at most 150 characters/],
    ["an API name with backticks", { from: "`z.nativeEnum()`" }, "from", /bare code/],
    ["an API name with spaces", { to: "the enum function" }, "to", /bare code/],
    ["a code fence in the code", { before: "```ts\nz.nativeEnum(E)\n```" }, "before", /code fences are added for you/],
    ["code with a trailing newline", { after: "z.enum(E)\n" }, "after", /blank lines/],
    ["too many lines", { before: `z.nativeEnum(E)${"\n//".repeat(15)}` }, "before", /at most 15 lines/],
    ["an unsupported language", { language: "python" }, "language", /must be one of ts, tsx, js, jsx/],
    ["before that doesn't use from", { before: "const Color = z.string();" }, "before", /must use `z.nativeEnum\(\)`/],
    ["after that still uses from", { after: "z.enum(z.nativeEnum(E))" }, "after", /must not use `z.nativeEnum\(\)`/],
    ["after that doesn't use to", { after: "const Color = z.string();" }, "after", /must use `z.enum\(\)`/],
  ])("rejects %s", (_label, fields, field, message) => {
    const result = validate({ ...replace, ...fields });
    expect(result).toMatchObject({ success: false, issues: [{ path: `codeExamples[0].${field}` }] });
    expect(result.success === false && result.feedback).toMatch(message);
  });

  it("rejects identical before and after", () => {
    const result = validate({ ...update, after: update.before });
    expect(result).toMatchObject({ success: false, issues: [{ path: "codeExamples[0].after" }] });
    expect(result.success === false && result.feedback).toMatch(/must differ from before/);
  });

  it("rejects an update whose after no longer uses the API", () => {
    const result = validate({ ...update, after: "const Color = z.enum(ColorEnum);" });
    expect(result).toMatchObject({ success: false, issues: [{ path: "codeExamples[0].after" }] });
    expect(result.success === false && result.feedback).toMatch(/must use `z.nativeEnum\(\)`/);
  });

  it("allows at most 12 code examples", () => {
    const codeExamples = Array.from({ length: 13 }, () => replace);
    expect(jsPackageMigrationGuide.validateJson({ ...migrationExample, codeExamples })).toMatchObject({
      success: false,
      issues: [{ path: "codeExamples", message: "include at most 12 codeExamples" }],
    });
  });
});

describe("president-description", () => {
  const render = (fields: object) => presidentDescription.jsonToString({ ...presidentExample, ...fields });
  const validate = (fields: object) => presidentDescription.validateJson({ ...presidentExample, ...fields });
  const { died: _died, ...living } = presidentExample;
  const [firstTerm, secondTerm] = presidentExample.terms;

  it.each([
    [[1], "the 1st president"],
    [[2], "the 2nd president"],
    [[3], "the 3rd president"],
    [[11], "the 11th president"],
    [[22, 24], "the 22nd and 24th president"],
    [[43], "the 43rd president"],
  ])("writes numbers %j as %s", (numbers, expected) => {
    expect(render({ numbers })).toContain(`was ${expected} of the United States.`);
  });

  it("leaves out the death year for a living president", () => {
    expect(presidentDescription.jsonToString(living)).toContain("\nHe was born in 1732.\n");
  });

  it("conjugates for they", () => {
    expect(render({ pronoun: "they" })).toContain("They were born in 1732, and they died in 1799.");
  });

  it.each([
    [[], "with no vice president"],
    [["Spiro Agnew", "Gerald Ford"], "with Spiro Agnew and Gerald Ford as vice presidents"],
  ])("writes vice presidents %j", (vicePresidents, expected) => {
    expect(render({ terms: [{ ...firstTerm, vicePresidents }] })).toContain(
      `- April 30, 1789 to March 4, 1793, ${expected}\n`,
    );
  });

  it("writes a term in progress", () => {
    const terms = [firstTerm, { start: "1793-03-04", vicePresidents: ["John Adams"] }];
    expect(presidentDescription.jsonToString({ ...living, terms })).toContain(
      "- Since March 4, 1793, with John Adams as vice president\n",
    );
  });

  const timeline = (...years: number[]) => years.map((year) => ({ year, event: "Something happened" }));

  it.each([
    ["a date that doesn't exist", { born: "1731-02-29" }, "born", /real date/],
    ["a death before birth", { died: "1700-01-01" }, "died", /after born/],
    ["numbers out of order", { numbers: [24, 22] }, "numbers[1]", /increasing order/],
    ["a term before birth", { terms: [{ ...firstTerm, start: "1700-01-01" }] }, "terms[0].start", /after born/],
    ["a term that ends before it starts", { terms: [{ ...firstTerm, end: "1789-01-01" }] }, "terms[0].end", /after its start/],
    ["overlapping terms", { terms: [firstTerm, { ...secondTerm, start: "1792-01-01" }] }, "terms[1].start", /previous term's end/],
    ["a term after death", { terms: [{ ...firstTerm, end: "1800-01-01" }] }, "terms[0].end", /after died/],
    ["an open term after death", { terms: [{ ...firstTerm, end: undefined }] }, "terms[0].end", /required when died/],
    ["a timeline out of order", { timeline: timeline(1790, 1780, 1795) }, "timeline[1].year", /in order/],
    ["a timeline year after death", { timeline: timeline(1780, 1790, 1800) }, "timeline[2].year", /\(1732–1799\)/],
    ["a summary of three sentences", { summary: "One. Two. Three." }, "summary", /at most 2 sentences/],
    ["a summary that is too long", { summary: `${"a".repeat(300)}.` }, "summary", /at most 300 characters/],
    ["formatting in a cell", { knownFor: [{ name: "**War**", description: "Won it" }] }, "knownFor[0].name", /strong formatting/],
    ["a cell that ends with a period", { knownFor: [{ name: "War", description: "Won it." }] }, "knownFor[0].description", /end with a period/],
  ])("rejects %s", (_label, fields, path, message) => {
    const result = validate(fields);
    // A bad date can break several rules at once, so look for this one among them.
    expect(result).toMatchObject({ success: false, issues: expect.arrayContaining([expect.objectContaining({ path })]) });
    expect(result.success === false && result.feedback).toMatch(message);
  });

  it("allows an open term only on the last term", () => {
    const terms = [{ start: "1789-04-30", vicePresidents: [] }, secondTerm];
    expect(presidentDescription.validateJson({ ...living, terms })).toMatchObject({
      success: false,
      issues: [{ path: "terms[0].end", message: expect.stringMatching(/except on the last term/) }],
    });
  });
});

describe("linked-in-post", () => {
  const validate = (fields: object) =>
    linkedInPost.validateJson({ ...linkedInExample, ...fields });

  it("renders each field into its sentence", () => {
    const markdown = linkedInPost.jsonToString({
      ...linkedInExample,
      timeframe: "Last month",
      mundaneEvent: "vacuumed my rug",
    });
    expect(markdown).toMatch(
      /^Last month, I vacuumed my rug\. Because I'm an entrepreneur/,
    );
  });

  it.each([
    [
      "a lowercase timeframe",
      { timeframe: "yesterday" },
      "timeframe",
      /capital letter/,
    ],
    [
      "a timeframe with a comma",
      { timeframe: "Yesterday," },
      "timeframe",
      /comma is added for you/,
    ],
    [
      "a capitalized mundaneEvent",
      { mundaneEvent: "Stubbed my toe" },
      "mundaneEvent",
      /lowercase letter/,
    ],
    [
      "a mundaneEvent with a period",
      { mundaneEvent: "stubbed my toe." },
      "mundaneEvent",
      /must not end with punctuation/,
    ],
    [
      "an epiphany with no period",
      { epiphany: "Toes are universal" },
      "epiphany",
      /end with a period/,
    ],
    [
      "a lesson of two sentences",
      { lesson: "Keep going. Never stop." },
      "lesson",
      /exactly 1 sentence/,
    ],
    [
      "a lesson that is too long",
      { lesson: `${"a".repeat(150)}.` },
      "lesson",
      /at most 150 characters/,
    ],
    [
      "formatting in whatDoesMatter",
      { whatDoesMatter: "what you do **next**" },
      "whatDoesMatter",
      /strong formatting/,
    ],
    [
      "a whatDoesNotMatter that is too long",
      { whatDoesNotMatter: "a".repeat(81) },
      "whatDoesNotMatter",
      /at most 80/,
    ],
  ])("rejects %s", (_label, fields, path, message) => {
    const result = validate(fields);
    expect(result).toMatchObject({
      success: false,
      issues: expect.arrayContaining([expect.objectContaining({ path })]),
    });
    expect(result.success === false && result.feedback).toMatch(message);
  });
});
