import Markdoc from "@markdoc/markdoc";
import { describe, expect, it } from "vitest";
import {
  contentBuilder,
  inlineMarkdownProblems,
} from "../src/content-builder.ts";

const {
  bulletList,
  code,
  document,
  em,
  fence,
  heading,
  inlineMarkdown,
  link,
  orderedList,
  paragraph,
  strong,
  tab,
  table,
  tabs,
  tag,
  toMarkup,
} = contentBuilder("markdoc");

describe("markdoc mode", () => {
  it("builds blocks and inline formatting", () => {
    const markdown = toMarkup(
      document(
        heading(2, "Setup"),
        paragraph(
          "Run ",
          code("npm install"),
          " then read ",
          link("https://example.com", "the docs"),
          ".",
        ),
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
    const markdown = toMarkup(
      document(
        bulletList(["plain", [strong("Note:"), " mixed"]]),
        orderedList(["first", "second"]),
      ),
    );

    expect(markdown).toContain("- plain\n- **Note:** mixed");
    expect(markdown).toContain("1. first\n2. second");
  });

  it("builds fenced code blocks that round-trip through the parser", () => {
    const markdown = toMarkup(
      document(fence("ts", "const a = 1;\n\nconst b = 2;")),
    );
    expect(markdown).toBe("```ts\nconst a = 1;\n\nconst b = 2;\n```\n");
    expect(Markdoc.parse(markdown).children[0]).toMatchObject({
      type: "fence",
      attributes: { language: "ts", content: "const a = 1;\n\nconst b = 2;\n" },
    });
  });

  it("drops falsy children and flattens arrays", () => {
    const show = false;
    const markdown = toMarkup(
      document(paragraph("kept"), show && paragraph("dropped"), null, [
        paragraph("flattened"),
      ]),
    );

    expect(markdown).toBe("kept\n\nflattened\n");
  });

  it("builds table tags with inline cells that round-trip through the parser", () => {
    const markdown = toMarkup(
      document(
        table(["Type", "Description"], [[code("string | number"), "a union"]]),
      ),
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
    expect(toMarkup(Markdoc.parse(markdown))).toBe(markdown);
  });

  it("builds nested tags that round-trip through the parser", () => {
    const markdown = toMarkup(
      document(
        tabs(
          tab(
            "npm",
            paragraph("Install with:"),
            bulletList([code("npm install @acme/sdk")]),
          ),
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
    expect(toMarkup(Markdoc.parse(markdown))).toBe(markdown);
  });

  it("quotes tag attributes", () => {
    expect(
      toMarkup(
        document(
          tag(
            "callout",
            { type: "warning", title: 'Say "hi"' },
            paragraph("x"),
          ),
        ),
      ),
    ).toContain('{% callout type="warning" title="Say \\"hi\\"" %}');
  });
});

describe("markdown mode", () => {
  const m = contentBuilder("markdown");

  it("builds a pipe table with escaped pipes that round-trips through the parser", () => {
    const markdown = m.toMarkup(
      m.document(
        m.table(
          ["Type", "Description"],
          [[m.code("string | number"), "a | b"]],
        ),
      ),
    );

    expect(markdown).toBe(
      [
        "| Type               | Description |",
        "| ------------------ | ----------- |",
        "| `string \\| number` | a \\| b      |",
        "",
      ].join("\n"),
    );
    const [parsed] = Markdoc.parse(markdown).children;
    expect(parsed?.type).toBe("table");
    const cells = [...parsed!.walk()].filter(
      (child) => child.type === "code" || child.type === "text",
    );
    expect(cells.map((child) => child.attributes.content)).toEqual([
      "Type",
      "Description",
      "string | number",
      "a | b",
    ]);
  });

  it("leaves a node used in a table cell unescaped elsewhere", () => {
    const union = m.code("string | number");
    const markdown = m.toMarkup(
      m.document(m.table(["Type"], [[union]]), m.paragraph(union)),
    );
    expect(markdown).toContain("\n`string | number`\n");
  });

  it("rejects a table cell with a line break", () => {
    expect(() => m.table(["Note"], [["two\nlines"]])).toThrow(/single line/);
  });

  it.each(["tag", "tabs", "tab"] as const)(
    "throws on %s, which only Markdoc has",
    (name) => {
      // @ts-expect-error Markdoc-only builders can't be called in markdown mode.
      expect(() => m[name]("x", {})).toThrow(
        `${name}() isn't available in markdown mode`,
      );
    },
  );
});

describe("html mode", () => {
  const tags = {
    note: {
      render: "aside",
      attributes: { tone: { type: String, required: true } },
    },
  };
  const m = contentBuilder("html", tags);

  it("renders built-in nodes as escaped HTML, without an article wrapper", () => {
    const html = m.toMarkup(
      m.document(
        m.heading(2, "Fish & <chips>"),
        m.paragraph(m.link('https://x.test?a=1&b="2"', "link")),
        m.table(["A"], [["1"]]),
      ),
    );
    expect(html).toBe(
      "<h2>Fish &amp; &lt;chips&gt;</h2>" +
        '<p><a href="https://x.test?a=1&amp;b=&quot;2&quot;">link</a></p>' +
        "<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>",
    );
  });

  it("renders a declared tag with its schema", () => {
    expect(
      m.toMarkup(
        m.document(m.tag("note", { tone: "warm" }, m.paragraph("Hi"))),
      ),
    ).toBe('<aside tone="warm"><p>Hi</p></aside>');
  });

  it("rejects a tag that isn't declared", () => {
    // @ts-expect-error `m.tag` only takes declared tags.
    const callout = m.tag("callout", {});
    expect(() => m.toMarkup(m.document(callout))).toThrow(
      "Can't render HTML: Undefined tag: 'callout'",
    );
  });

  it("rejects a declared tag with invalid attributes", () => {
    expect(() =>
      m.toMarkup(m.document(m.tag("note", {}, m.paragraph("Hi")))),
    ).toThrow(/Can't render HTML: .*tone/);
  });

  it.each(["tabs", "tab"] as const)("throws on %s", (name) => {
    // @ts-expect-error tabs and tab need declared tags in html mode.
    expect(() => m[name]("x")).toThrow(
      `${name}() isn't available in html mode`,
    );
  });
});

describe("inline markdown", () => {
  it("renders inline code from a Markdown string", () => {
    expect(
      toMarkup(
        document(bulletList([inlineMarkdown("use `z.email()` instead")])),
      ),
    ).toBe("- use `z.email()` instead\n");
  });

  it.each(["use `z.email()` instead", "5 * 3 and snake_case_names"])(
    "accepts %j",
    (source) => {
      expect(inlineMarkdownProblems(source)).toEqual([]);
    },
  );

  it.each([
    ["an unmatched backtick", "use `z.email()", /unmatched backtick/],
    ["an escaped backtick", "\\`z.email()\\`", /unmatched backtick/],
    ["emphasis", "*important* change", /must not use em formatting/],
    [
      "a link",
      "see [the docs](https://zod.dev)",
      /must not use link formatting/,
    ],
    ["a list", "1. first step", /single line of inline Markdown/],
    ["a heading", "## Heading", /single line of inline Markdown/],
    ["a line break", "two\nlines", /must be a single line/],
    [
      "an escape that would not survive formatting",
      "\\[x](https://zod.dev)",
      /wouldn't render as written/,
    ],
    [
      "an escaped asterisk",
      "a literal \\*asterisk\\*",
      /wouldn't render as written/,
    ],
    [
      "a backtick inside code",
      "``code with a ` backtick``",
      /wouldn't render as written/,
    ],
  ])("rejects %s", (_label, source, message) => {
    expect(inlineMarkdownProblems(source).join("\n")).toMatch(message);
  });

  it("allows more formatting when asked", () => {
    expect(
      inlineMarkdownProblems("see [the docs](https://zod.dev)", [
        "code",
        "link",
      ]),
    ).toEqual([]);
  });
});
