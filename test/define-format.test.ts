import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineFormat,
  FormatValidationError,
  OUTPUT_TYPES,
} from "../src/define-format.ts";

const questions = defineFormat({
  name: "question-list",
  version: 1,
  description: "Up to four questions.",
  outputType: "json",
  schema: z.object({
    items: z
      .array(z.string().endsWith("?", "each item must end with `?`"))
      .max(4, "include at most 4 items"),
  }),
  example: { items: ["Why?"] },
});

describe("defineFormat", () => {
  it.each([0, 1.5, -1])("rejects version %s", (version) => {
    expect(() =>
      defineFormat({
        name: "bad",
        version,
        description: "",
        outputType: "json",
        schema: z.object({}),
      }),
    ).toThrow('Format "bad" has version');
  });

  it("lists the supported output types", () => {
    expect(OUTPUT_TYPES).toEqual([
      "plaintext",
      "markdown",
      "html",
      "markdoc",
      "json",
    ]);
  });

  it("requires an outputType", () => {
    expect(() =>
      // @ts-expect-error `outputType` is required.
      defineFormat({
        name: "bad",
        version: 1,
        description: "",
        schema: z.object({}),
      }),
    ).toThrow('Format "bad" has no outputType');
  });

  it("rejects an unknown outputType", () => {
    expect(() =>
      defineFormat({
        name: "bad",
        version: 1,
        description: "",
        // @ts-expect-error `outputType` must be one of OUTPUT_TYPES.
        outputType: "yaml",
        schema: z.object({}),
        render: () => "",
      }),
    ).toThrow(
      'Format "bad" has outputType "yaml"; use one of plaintext, markdown, html, markdoc, json',
    );
  });

  it("requires a render function for output other than JSON", () => {
    expect(() =>
      // @ts-expect-error `render` is required unless `outputType` is `json`.
      defineFormat({
        name: "bad",
        version: 1,
        description: "",
        outputType: "markdown",
        schema: z.object({}),
      }),
    ).toThrow(
      'Format "bad" has outputType "markdown", so it needs a render function',
    );
  });

  it("accepts a valid document", () => {
    expect(questions.validateJson({ items: ["Why?", "How?"] })).toEqual({
      success: true,
      data: { items: ["Why?", "How?"] },
    });
  });

  it("accepts a raw JSON string", () => {
    expect(questions.validateJson('{"items":["Why?"]}').success).toBe(true);
  });

  it("reports malformed JSON as feedback instead of throwing", () => {
    const result = questions.validateJson("{nope");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0]?.message).toMatch(/not valid JSON/);
    }
  });

  it("reports each issue with a readable path", () => {
    const result = questions.validateJson({ items: ["Why?", "Because."] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toEqual([
        { path: "items[1]", message: "each item must end with `?`" },
      ]);
      expect(result.feedback).toContain("items[1]");
    }
  });

  it("exposes schema constraints through getInfo()", () => {
    const info = questions.getInfo();
    expect(info.outputType).toBe("json");
    expect(info.jsonSchema).toMatchObject({
      properties: { items: { maxItems: 4, items: { pattern: ".*\\?$" } } },
    });
    expect(info.instructions).toContain("# Output format: question-list v1");
    expect(info.instructions).toContain('"Why?"');
  });

  it("renders JSON when no render function is given", () => {
    expect(questions.jsonToString({ items: ["Why?"] })).toBe(
      JSON.stringify({ items: ["Why?"] }, null, 2),
    );
  });

  it("renders with the format's render function", () => {
    const list = defineFormat({
      name: "question-list",
      version: 1,
      description: "",
      outputType: "markdown",
      schema: z.object({ items: z.array(z.string()) }),
      render: (data) => data.items.map((item) => `- ${item}`).join("\n"),
    });
    expect(list.jsonToString({ items: ["Why?", "How?"] })).toBe(
      "- Why?\n- How?",
    );
  });

  it("passes a content builder for the outputType", () => {
    const definition = {
      name: "note",
      version: 1,
      description: "",
      schema: z.object({ text: z.string() }),
    };
    const markdown = defineFormat({
      ...definition,
      outputType: "markdown",
      render: (data, m) =>
        m.toMarkup(m.document(m.table(["Note"], [[data.text]]))),
    });
    const markdoc = defineFormat({
      ...definition,
      outputType: "markdoc",
      render: (data, m) =>
        m.toMarkup(m.document(m.table(["Note"], [[data.text]]))),
    });
    expect(markdown.jsonToString({ text: "Hi" })).toBe(
      "| Note |\n| ---- |\n| Hi   |\n",
    );
    expect(markdoc.jsonToString({ text: "Hi" })).toBe(
      "{% table %}\n- Note\n---\n- Hi\n{% /table %}\n",
    );
  });

  it("only gives Markdoc tags to markdoc output", () => {
    const tagged = defineFormat({
      name: "tagged",
      version: 1,
      description: "",
      outputType: "markdown",
      schema: z.object({}),
      // @ts-expect-error `tag` isn't available in markdown mode.
      render: (_data, m) => m.toMarkup(m.document(m.tag("note", {}))),
    });
    expect(() => tagged.jsonToString({})).toThrow(
      "tag() isn't available in markdown mode",
    );
  });

  it("refuses to render an invalid document", () => {
    expect(() => questions.jsonToString({ items: ["Because."] })).toThrow(
      FormatValidationError,
    );
  });
});

describe("default messages", () => {
  const people = defineFormat({
    name: "people",
    version: 1,
    description: "",
    outputType: "json",
    schema: z
      .object({
        title: z.string().min(1),
        size: z.enum(["small", "large"]),
        people: z
          .array(
            z
              .object({
                name: z.string(),
                age: z.int().max(150),
                tags: z.array(z.string()),
              })
              .strict(),
          )
          .min(1),
        custom: z.string({ error: "custom has its own message" }),
      })
      .strict(),
  });
  const valid = {
    title: "T",
    size: "small",
    people: [{ name: "Ada", age: 36, tags: [] }],
    custom: "c",
  };
  const messageAt = (input: object, path: string) => {
    const result = people.validateJson({ ...valid, ...input });
    return result.success
      ? undefined
      : result.issues.find((issue) => issue.path === path)?.message;
  };

  it.each([
    [{ title: undefined }, "title", "title is required and must be a string"],
    [{ title: 3 }, "title", "title must be a string"],
    [{ title: "" }, "title", "title must not be empty"],
    [{ size: "medium" }, "size", "size must be one of small, large"],
    [{ people: [] }, "people", "people must have at least 1 item"],
    [{ people: [3] }, "people[0]", "each people item must be an object"],
    [
      { people: [{ name: "Ada", age: 1.5, tags: [] }] },
      "people[0].age",
      "each people age must be a whole number",
    ],
    [
      { people: [{ name: "Ada", age: 200, tags: [] }] },
      "people[0].age",
      "each people age must be at most 150",
    ],
    [
      { people: [{ name: "Ada", age: 36, tags: [1] }] },
      "people[0].tags[0]",
      "each people tags item must be a string",
    ],
    [
      { people: [{ name: "Ada", age: 36, tags: [], extra: 1 }] },
      "people[0]",
      "each people item has unknown field `extra`",
    ],
    [
      { more: 1, extra: 2 },
      "",
      "the document has unknown fields `more`, `extra`",
    ],
    [{ custom: 3 }, "custom", "custom has its own message"],
  ])("words %o at %s", (input, path, message) => {
    expect(messageAt(input, path)).toBe(message);
  });
});
