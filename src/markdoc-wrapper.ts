import Markdoc, { type Node } from "@markdoc/markdoc";

// Readable builders for Markdoc AST nodes, so render functions read like the
// document they produce:
//
//   toMarkdown(document(
//     heading(2, "Questions"),
//     bulletList(data.questions),
//   ))
//
// Strings become text nodes. `false`, `null`, and `undefined` are dropped and
// arrays are flattened, so `cond && [heading(...), bulletList(...)]` works.

export type Child = Node | string | false | null | undefined | Child[];

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

export function document(...children: Child[]): Node {
  return node("document", {}, toNodes(children));
}

export function paragraph(...children: Child[]): Node {
  return node("paragraph", {}, [inline(children)]);
}

export function heading(level: 1 | 2 | 3 | 4 | 5 | 6, ...children: Child[]): Node {
  return node("heading", { level }, [inline(children)]);
}

/** Each entry is one list item: a string, an inline node, or an array of them. */
export function bulletList(items: Child[]): Node {
  return list(items, { ordered: false, marker: "-" });
}

export function orderedList(items: Child[]): Node {
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
export function fence(language: string, content: string): Node {
  return node("fence", { language, content: content.endsWith("\n") ? content : `${content}\n` });
}

/**
 * A `{% table %}` tag. Each cell is a string, an inline node, or an array of them.
 * Unlike a pipe table, cells may contain `|`.
 */
export function table(headers: Child[], rows: Child[][]): Node {
  const row = (cells: Child[], cellType: "th" | "td") =>
    node(
      "tr",
      {},
      cells.map((cell) => node(cellType, {}, [inline([cell])])),
    );
  return tag(
    "table",
    {},
    node("table", {}, [
      node("thead", {}, [row(headers, "th")]),
      node(
        "tbody",
        {},
        rows.map((cells) => row(cells, "td")),
      ),
    ]),
  );
}

// Tags

/** A block-level Markdoc tag: `{% name attr="value" %}...{% /name %}`. */
export function tag(
  name: string,
  attributes: Record<string, unknown>,
  ...children: Child[]
): Node {
  return node("tag", attributes, toNodes(children), name);
}

/** `{% tabs %}`. Children should be `tab()` nodes. */
export function tabs(...children: Child[]): Node {
  return tag("tabs", {}, ...children);
}

/** `{% tab title="..." %}`. Children are blocks, like `paragraph()` or `bulletList()`. */
export function tab(title: string, ...children: Child[]): Node {
  return tag("tab", { title }, ...children);
}

// Inline

export function text(content: string): Node {
  return node("text", { content });
}

export function strong(...children: Child[]): Node {
  return node("strong", { marker: "**" }, toNodes(children));
}

export function em(...children: Child[]): Node {
  return node("em", { marker: "*" }, toNodes(children));
}

export function code(content: string): Node {
  return node("code", { content });
}

export function link(href: string, ...children: Child[]): Node {
  return node("link", { href }, toNodes(children));
}

// Inline Markdown strings, like "use `z.email()`"

export type InlineFormatting = "code" | "strong" | "em" | "link";

/** Parses one line of inline Markdown into nodes. Check it with `inlineMarkdownProblems` first. */
export function inlineMarkdown(source: string): Node[] {
  const nodes = parseInline(source);
  if (!nodes) throw new Error(`Not a single line of inline Markdown: ${JSON.stringify(source)}`);
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
  if (!nodes) return ["must be a single line of inline Markdown, not a list, heading, or tag"];

  const problems = new Set<string>();
  for (const child of descendants(nodes)) {
    if (child.type === "text") {
      if (String(child.attributes.content).includes("`")) {
        problems.add("has an unmatched backtick: wrap code in a pair, like `z.email()`");
      }
    } else if (child.type === "softbreak" || child.type === "hardbreak") {
      problems.add("must be a single line");
    } else if (!(allowed as readonly string[]).includes(child.type)) {
      const allowedList = allowed.length > 0 ? allowed.join(", ") : "none";
      problems.add(`must not use ${child.type} formatting (allowed: ${allowedList})`);
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
  const reparsed = parseInline(toMarkdown(document(paragraph(nodes))));
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

export function toMarkdown(root: Node): string {
  return Markdoc.format(root, { orderedListMode: "increment" });
}
