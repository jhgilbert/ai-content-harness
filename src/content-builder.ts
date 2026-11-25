import Markdoc, { type Node, type Schema } from "@markdoc/markdoc";

// Readable builders for content, so render functions read like the document
// they produce. `defineFormat()` passes a builder for the format's output type:
//
//   m.toMarkup(m.document(
//     m.heading(2, "Questions"),
//     m.bulletList(data.questions),
//   ))
//
// Builders make Markdoc AST nodes, since Markdoc's formatter writes Markdown
// too. In `markdown` mode, Markdoc-only builders like `tag` throw, and `table`
// makes a pipe table instead of a `{% table %}` tag. In `html` mode, Markdoc
// renders the nodes as HTML, and `tag` takes only the tags the format declares.
//
// Strings become text nodes. `false`, `null`, and `undefined` are dropped and
// arrays are flattened, so `cond && [heading(...), bulletList(...)]` works.

export type Child = Node | string | false | null | undefined | Child[];

/** A builder that doesn't exist in this mode. It's a type error to call it, and it throws at runtime. */
type Unavailable = (...args: never) => never;

export type ContentMode = keyof Builders;

/** How each custom tag renders in `html` mode, keyed by tag name. See Markdoc's tag schemas. */
export type HtmlTags = Record<string, Schema>;

const shared = {
  document,
  paragraph,
  heading,
  bulletList,
  orderedList,
  fence,
  text,
  strong,
  em,
  code,
  link,
  inlineMarkdown,
};

/** The builder for each mode. Add a mode here to give it a builder. */
interface Builders<Tags extends HtmlTags = HtmlTags> {
  markdown: typeof shared & {
    table: typeof pipeTable;
    tag: Unavailable;
    tabs: Unavailable;
    tab: Unavailable;
    /** Writes Markdown. */
    toMarkup: typeof format;
  };
  markdoc: typeof shared & {
    table: typeof tagTable;
    tag: typeof tag;
    tabs: typeof tabs;
    tab: typeof tab;
    /** Writes Markdoc. */
    toMarkup: typeof format;
  };
  html: typeof shared & {
    table: typeof tagTable;
    /** A tag from the format's `tags`, which say how it renders. */
    tag: (
      name: Extract<keyof Tags, string>,
      attributes: Record<string, unknown>,
      ...children: Child[]
    ) => Node;
    tabs: Unavailable;
    tab: Unavailable;
    /** Writes HTML. Throws if a tag isn't declared in `tags` or its attributes are invalid. */
    toMarkup: (root: Node) => string;
  };
}

/**
 * The builder `render` receives as `m`, e.g. `ContentBuilder<"markdoc">`. For
 * `html`, `Tags` is the format's `tags`: `ContentBuilder<"html", typeof tags>`.
 */
export type ContentBuilder<
  Mode extends ContentMode = ContentMode,
  Tags extends HtmlTags = {},
> = Builders<Tags>[Mode];

function builders<Tags extends HtmlTags>(tags: Tags): Builders<Tags> {
  return {
    markdown: {
      ...shared,
      table: pipeTable,
      tag: unavailable("tag", MARKDOWN_HAS_NO_TAGS),
      tabs: unavailable("tabs", MARKDOWN_HAS_NO_TAGS),
      tab: unavailable("tab", MARKDOWN_HAS_NO_TAGS),
      toMarkup: format,
    },
    markdoc: {
      ...shared,
      table: tagTable,
      tag,
      tabs,
      tab,
      toMarkup: format,
    },
    html: {
      ...shared,
      table: tagTable,
      tag,
      tabs: unavailable("tabs", DECLARE_HTML_TAGS),
      tab: unavailable("tab", DECLARE_HTML_TAGS),
      toMarkup: (root) => toHtml(root, tags),
    },
  };
}

/** `tags` says how each custom tag renders in `html` mode. Other modes ignore it. */
export function contentBuilder<
  Mode extends ContentMode,
  Tags extends HtmlTags = {},
>(mode: Mode, tags: Tags = {} as Tags): ContentBuilder<Mode, Tags> {
  const all = builders(tags);
  if (!Object.hasOwn(all, mode)) {
    throw new Error(
      `No content builder for mode "${mode}"; use ${Object.keys(all).join(", ")}`,
    );
  }
  return all[mode];
}

const MARKDOWN_HAS_NO_TAGS =
  'isn\'t available in markdown mode, because Markdown has no tags. Use outputType "markdoc".';
const DECLARE_HTML_TAGS =
  "isn't available in html mode. Declare the tag in the format's `tags` and use tag().";

function unavailable(name: string, reason: string): Unavailable {
  return () => {
    throw new Error(`${name}() ${reason}`);
  };
}

const { Node: AstNode } = Markdoc.Ast;

function node(
  type: Node["type"],
  attributes: Record<string, unknown> = {},
  children: Node[] = [],
  tagName?: string,
): Node {
  return new AstNode(type, attributes, children, tagName);
}

function toNodes(children: Child[]): Node[] {
  return children.flat(Infinity as 1).flatMap((child: Child) => {
    if (child === false || child === null || child === undefined) return [];
    if (typeof child === "string") return [text(child)];
    return [child as Node];
  });
}

/** Wraps inline children the way Markdoc's parser does for blocks. */
function inline(children: Child[]): Node {
  return node("inline", {}, toNodes(children));
}

// Blocks

function document(...children: Child[]): Node {
  return node("document", {}, toNodes(children));
}

function paragraph(...children: Child[]): Node {
  return node("paragraph", {}, [inline(children)]);
}

function heading(level: 1 | 2 | 3 | 4 | 5 | 6, ...children: Child[]): Node {
  return node("heading", { level }, [inline(children)]);
}

/** Each entry is one list item: a string, an inline node, or an array of them. */
function bulletList(items: Child[]): Node {
  return list(items, { ordered: false, marker: "-" });
}

function orderedList(items: Child[]): Node {
  return list(items, { ordered: true, marker: "." });
}

function list(items: Child[], attributes: Record<string, unknown>): Node {
  return node(
    "list",
    attributes,
    items.map((item) => node("item", {}, [inline([item])])),
  );
}

/** A fenced code block. `content` should not contain a fence of its own. */
function fence(language: string, content: string): Node {
  return node("fence", {
    language,
    content: content.endsWith("\n") ? content : `${content}\n`,
  });
}

/** A `{% table %}` tag. Each cell is a string, an inline node, or an array of them. */
function tagTable(headers: Child[], rows: Child[][]): Node {
  return tag(
    "table",
    {},
    tableNode(headers, rows, (cell) => inline([cell])),
  );
}

/**
 * A pipe table, from GitHub Flavored Markdown. Each cell is a string, an
 * inline node, or an array of them, and must be a single line.
 */
function pipeTable(headers: Child[], rows: Child[][]): Node {
  return tableNode(headers, rows, (cell) => escapePipes(inline([cell])));
}

function tableNode(
  headers: Child[],
  rows: Child[][],
  cellContent: (cell: Child) => Node,
): Node {
  const row = (cells: Child[], cellType: "th" | "td") =>
    node(
      "tr",
      {},
      cells.map((cell) => node(cellType, {}, [cellContent(cell)])),
    );
  return node("table", {}, [
    node("thead", {}, [row(headers, "th")]),
    node(
      "tbody",
      {},
      rows.map((cells) => row(cells, "td")),
    ),
  ]);
}

/**
 * Copies a pipe table cell with each `|` written as `\|`, which GFM reads as a
 * pipe even inside code. Markdoc's formatter doesn't escape them itself.
 * Copies, rather than edits, since a node like `code(...)` may be used elsewhere.
 */
function escapePipes(cell: Node): Node {
  if (cell.type === "softbreak" || cell.type === "hardbreak") {
    throw new Error("A pipe table cell must be a single line");
  }
  const attributes = { ...cell.attributes };
  for (const key of ["content", "href"]) {
    const value = attributes[key];
    if (typeof value !== "string") continue;
    if (value.includes("\n"))
      throw new Error(
        `A pipe table cell must be a single line: ${JSON.stringify(value)}`,
      );
    attributes[key] = value.replaceAll("|", "\\|");
  }
  return node(cell.type, attributes, cell.children.map(escapePipes), cell.tag);
}

// Tags

/** A block-level Markdoc tag: `{% name attr="value" %}...{% /name %}`. */
function tag(
  name: string,
  attributes: Record<string, unknown>,
  ...children: Child[]
): Node {
  return node("tag", attributes, toNodes(children), name);
}

/** `{% tabs %}`. Children should be `tab()` nodes. */
function tabs(...children: Child[]): Node {
  return tag("tabs", {}, ...children);
}

/** `{% tab title="..." %}`. Children are blocks, like `paragraph()` or `bulletList()`. */
function tab(title: string, ...children: Child[]): Node {
  return tag("tab", { title }, ...children);
}

// Inline

function text(content: string): Node {
  return node("text", { content });
}

function strong(...children: Child[]): Node {
  return node("strong", { marker: "**" }, toNodes(children));
}

function em(...children: Child[]): Node {
  return node("em", { marker: "*" }, toNodes(children));
}

function code(content: string): Node {
  return node("code", { content });
}

function link(href: string, ...children: Child[]): Node {
  return node("link", { href }, toNodes(children));
}

// Inline Markdown strings, like "use `z.email()`"

export type InlineFormatting = "code" | "strong" | "em" | "link";

/** Parses one line of inline Markdown into nodes. Check it with `inlineMarkdownProblems` first. */
function inlineMarkdown(source: string): Node[] {
  const nodes = parseInline(source);
  if (!nodes)
    throw new Error(
      `Not a single line of inline Markdown: ${JSON.stringify(source)}`,
    );
  return nodes;
}

/**
 * Why `source` isn't a single line of inline Markdown that uses only `allowed`
 * formatting. Each problem completes a sentence like "each item ...".
 * Markdown never fails to parse, so this inspects what Markdoc produced.
 */
export function inlineMarkdownProblems(
  source: string,
  allowed: readonly InlineFormatting[] = ["code"],
): string[] {
  if (source.trim() === "") return [];
  const nodes = parseInline(source);
  if (!nodes)
    return [
      "must be a single line of inline Markdown, not a list, heading, or tag",
    ];

  const problems = new Set<string>();
  for (const child of descendants(nodes)) {
    if (child.type === "text") {
      if (String(child.attributes.content).includes("`")) {
        problems.add(
          "has an unmatched backtick: wrap code in a pair, like `z.email()`",
        );
      }
    } else if (child.type === "softbreak" || child.type === "hardbreak") {
      problems.add("must be a single line");
    } else if (!(allowed as readonly string[]).includes(child.type)) {
      const allowedList = allowed.length > 0 ? allowed.join(", ") : "none";
      problems.add(
        `must not use ${child.type} formatting (allowed: ${allowedList})`,
      );
    }
  }
  if (problems.size === 0 && !roundTrips(nodes)) {
    problems.add(
      "uses Markdown that wouldn't render as written, such as backslash escapes or a backtick inside code",
    );
  }
  return [...problems];
}

function parseInline(source: string): Node[] | undefined {
  const [block, ...rest] = Markdoc.parse(source).children;
  if (!block || rest.length > 0 || block.type !== "paragraph") return undefined;
  return block.children[0]?.children ?? [];
}

function* descendants(nodes: Node[]): Generator<Node> {
  for (const child of nodes) {
    yield child;
    yield* descendants(child.children);
  }
}

/** Whether formatting `nodes` and parsing the result gives back the same nodes. */
function roundTrips(nodes: Node[]): boolean {
  const reparsed = parseInline(format(document(paragraph(nodes))));
  return reparsed !== undefined && shape(reparsed) === shape(nodes);
}

function shape(nodes: Node[]): string {
  const describe = (child: Node): unknown => [
    child.type,
    child.attributes.content ?? child.attributes.href ?? null,
    child.children.map(describe),
  ];
  return JSON.stringify(nodes.map(describe));
}

// Output

function format(root: Node): string {
  return Markdoc.format(root, { orderedListMode: "increment" });
}

/** Renders `root` as HTML, without the `<article>` Markdoc wraps a document in. */
function toHtml(root: Node, tags: HtmlTags): string {
  const config = { tags };
  const errors = Markdoc.validate(root, config).filter(
    ({ error }) => error.level === "error" || error.level === "critical",
  );
  if (errors.length > 0) {
    const messages = errors.map(({ error }) => error.message).join("; ");
    throw new Error(`Can't render HTML: ${messages}`);
  }
  const tree = Markdoc.transform(root, config);
  const isArticle = tree instanceof Markdoc.Tag && tree.name === "article";
  return Markdoc.renderers.html(isArticle ? tree.children : tree);
}
