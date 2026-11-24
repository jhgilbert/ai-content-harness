import Markdoc from "@markdoc/markdoc";
import { describe, expect, it } from "vitest";
import {
  bulletList,
  code,
  document,
  em,
  fence,
  heading,
  inlineMarkdown,
  inlineMarkdownProblems,
  link,
  orderedList,
  paragraph,
  strong,
  tab,
  table,
  tabs,
  tag,
  toMarkdown,
} from "../src/markdoc-wrapper.ts";

describe("markdoc builders", () => {
  it("builds blocks and inline formatting", () => {
    const markdown = toMarkdown(
      document(
        heading(2, "Setup"),
        paragraph("Run ", code("npm install"), " then read ", link("https://example.com", "the docs"), "."),
        paragraph(strong("Bold ", em("and italic"))),
      ),
    );

    expect(markdown).toBe(
      [
        "## Setup",
        "",
        "Run `npm install` then read [the docs](https://example.com).",
        "",
        "**Bold *and italic***",
        "",
      ].join("\n"),
    );
  });

  it("builds lists whose items can mix strings and inline nodes", () => {
    const markdown = toMarkdown(
      document(bulletList(["plain", [strong("Note:"), " mixed"]]), orderedList(["first", "second"])),
    );

    expect(markdown).toContain("- plain\n- **Note:** mixed");
    expect(markdown).toContain("1. first\n2. second");
  });

  it("builds fenced code blocks that round-trip through the parser", () => {
    const markdown = toMarkdown(document(fence("ts", "const a = 1;\n\nconst b = 2;")));
    expect(markdown).toBe("```ts\nconst a = 1;\n\nconst b = 2;\n```\n");
    expect(Markdoc.parse(markdown).children[0]).toMatchObject({
      type: "fence",
      attributes: { language: "ts", content: "const a = 1;\n\nconst b = 2;\n" },
    });
  });

  it("drops falsy children and flattens arrays", () => {
    const show = false;
    const markdown = toMarkdown(
      document(paragraph("kept"), show && paragraph("dropped"), null, [paragraph("flattened")]),
    );

    expect(markdown).toBe("kept\n\nflattened\n");
  });

  it("builds table tags with inline cells that round-trip through the parser", () => {
    const markdown = toMarkdown(
      document(table(["Type", "Description"], [[code("string | number"), "a union"]])),
    );

    expect(markdown).toBe(
      [
        "{% table %}",
        "- Type",
        "- Description",
        "---",
        "- `string | number`",
        "- a union",
        "{% /table %}",
        "",
      ].join("\n"),
    );
    expect(toMarkdown(Markdoc.parse(markdown))).toBe(markdown);
  });

  it("builds nested tags that round-trip through the parser", () => {
    const markdown = toMarkdown(
      document(
        tabs(
          tab("npm", paragraph("Install with:"), bulletList([code("npm install @acme/sdk")])),
          tab("pnpm", paragraph(code("pnpm add @acme/sdk"))),
        ),
      ),
    );

    expect(markdown).toBe(
      [
        "{% tabs %}",
        '{% tab title="npm" %}',
        "Install with:",
        "",
        "- `npm install @acme/sdk`",
        "{% /tab %}",
        "",
        '{% tab title="pnpm" %}',
        "`pnpm add @acme/sdk`",
        "{% /tab %}",
        "{% /tabs %}",
        "",
      ].join("\n"),
    );
    expect(toMarkdown(Markdoc.parse(markdown))).toBe(markdown);
  });

  it("quotes tag attributes", () => {
    expect(toMarkdown(document(tag("callout", { type: "warning", title: 'Say "hi"' }, paragraph("x"))))).toContain(
      '{% callout type="warning" title="Say \\"hi\\"" %}',
    );
  });
});

describe("inline markdown", () => {
  it("renders inline code from a Markdown string", () => {
    expect(toMarkdown(document(bulletList([inlineMarkdown("use `z.email()` instead")])))).toBe(
      "- use `z.email()` instead\n",
    );
  });

  it.each([
    "use `z.email()` instead",
    "5 * 3 and snake_case_names",
  ])("accepts %j", (source) => {
    expect(inlineMarkdownProblems(source)).toEqual([]);
  });

  it.each([
    ["an unmatched backtick", "use `z.email()", /unmatched backtick/],
    ["an escaped backtick", "\\`z.email()\\`", /unmatched backtick/],
    ["emphasis", "*important* change", /must not use em formatting/],
    ["a link", "see [the docs](https://zod.dev)", /must not use link formatting/],
    ["a list", "1. first step", /single line of inline Markdown/],
    ["a heading", "## Heading", /single line of inline Markdown/],
    ["a line break", "two\nlines", /must be a single line/],
    ["an escape that would not survive formatting", "\\[x](https://zod.dev)", /wouldn't render as written/],
    ["an escaped asterisk", "a literal \\*asterisk\\*", /wouldn't render as written/],
    ["a backtick inside code", "``code with a ` backtick``", /wouldn't render as written/],
  ])("rejects %s", (_label, source, message) => {
    expect(inlineMarkdownProblems(source).join("\n")).toMatch(message);
  });

  it("allows more formatting when asked", () => {
    expect(inlineMarkdownProblems("see [the docs](https://zod.dev)", ["code", "link"])).toEqual([]);
  });
});
