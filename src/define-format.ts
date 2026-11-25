import { z } from "zod";
import {
  contentBuilder,
  type ContentMode,
  type MarkdocBuilder,
  type MarkdownBuilder,
} from "./content-builder.ts";

/** The kinds of final output a format can produce. */
export const OUTPUT_TYPES = [
  "plaintext",
  "markdown",
  "html",
  "markdoc",
  "json",
] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

interface FormatDefinitionBase<S extends z.ZodType> {
  /** Kebab-case identifier, e.g. `jira-card-description`. */
  name: string;
  /**
   * Starts at 1. Bump it whenever the schema or rendering changes, so a copy of
   * a standalone script can be checked against the latest.
   */
  version: number;
  /** What the output is for. Shown to Claude in `getInfo()`. */
  description: string;
  /** The single source of truth for structure and constraints. */
  schema: S;
  /** A valid sample document. Shown to Claude and checked in tests. */
  example?: z.input<S>;
}

/**
 * Templates validated data into the final string. For `markdown` and `markdoc`
 * output, `m` is the content builder for that mode.
 */
type Render<S extends z.ZodType, Builder = undefined> = (
  data: z.output<S>,
  m: Builder,
) => string;

/**
 * `render` is required unless `outputType` is `json`, so a format can't
 * accidentally emit JSON when it's meant to produce a string like Markdown.
 */
export type FormatDefinition<S extends z.ZodType> = FormatDefinitionBase<S> &
  (
    | {
        /** The final output is JSON. */
        outputType: "json";
        /** Omit to emit the validated document as pretty-printed JSON. */
        render?: Render<S>;
      }
    | { outputType: "markdown"; render: Render<S, MarkdownBuilder> }
    | { outputType: "markdoc"; render: Render<S, MarkdocBuilder> }
    | {
        /** Final output type after rendering, e.g. `html`. */
        outputType: Exclude<OutputType, "json" | ContentMode>;
        render: Render<S>;
      }
  );

export interface FormatInfo {
  name: string;
  version: number;
  description: string;
  outputType: OutputType;
  jsonSchema: Record<string, unknown>;
  example?: unknown;
  /** Ready-to-use prompt text that explains how to build the document. */
  instructions: string;
}

export interface ValidationIssue {
  /** Location of the problem, e.g. `openQuestions[2]`. Empty for the root. */
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ValidationIssue[]; feedback: string };

export interface Format<S extends z.ZodType = z.ZodType> {
  name: string;
  version: number;
  description: string;
  schema: S;
  getInfo(): FormatInfo;
  /** Accepts a parsed value or a raw JSON string. */
  validateJson(input: unknown): ValidationResult<z.output<S>>;
  /** Validates, then renders. Throws `FormatValidationError` if invalid. */
  jsonToString(input: unknown): string;
}

export class FormatValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(formatName: string, issues: ValidationIssue[], feedback: string) {
    super(`Invalid ${formatName} document.\n${feedback}`);
    this.name = "FormatValidationError";
    this.issues = issues;
  }
}

export function defineFormat<S extends z.ZodType>(
  definition: FormatDefinition<S>,
): Format<S> {
  const { name, version, description, schema, outputType, example, render } =
    definition;
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(
      `Format "${name}" has version ${version}; use a whole number starting at 1`,
    );
  }
  if (outputType === undefined) {
    throw new Error(`Format "${name}" has no outputType`);
  }
  if (!OUTPUT_TYPES.includes(outputType)) {
    throw new Error(
      `Format "${name}" has outputType "${outputType}"; use one of ${OUTPUT_TYPES.join(", ")}`,
    );
  }
  if (render === undefined && outputType !== "json") {
    throw new Error(
      `Format "${name}" has outputType "${outputType}", so it needs a render function`,
    );
  }

  function getInfo(): FormatInfo {
    // `io: "input"` describes what Claude must write, before any transforms or
    // defaults run. `unrepresentable: "any"` keeps `.refine()` and friends from
    // throwing; their intent should also be stated in a `.describe()`.
    const jsonSchema = z.toJSONSchema(schema, {
      io: "input",
      unrepresentable: "any",
    }) as Record<string, unknown>;

    return {
      name,
      version,
      description,
      outputType,
      jsonSchema,
      example,
      instructions: buildInstructions({
        name,
        version,
        description,
        jsonSchema,
        example,
      }),
    };
  }

  function validateJson(input: unknown): ValidationResult<z.output<S>> {
    let value = input;
    if (typeof input === "string") {
      try {
        value = JSON.parse(input);
      } catch (error) {
        const message = `Input is not valid JSON: ${(error as Error).message}`;
        return {
          success: false,
          issues: [{ path: "", message }],
          feedback: `✖ ${message}`,
        };
      }
    }

    const result = schema.safeParse(value, { error: defaultMessage });
    if (result.success) {
      return { success: true, data: result.data };
    }

    return {
      success: false,
      issues: result.error.issues.map((issue) => ({
        path: formatPath(issue.path),
        message: issue.message,
      })),
      feedback: z.prettifyError(result.error),
    };
  }

  function jsonToString(input: unknown): string {
    const result = validateJson(input);
    if (!result.success) {
      throw new FormatValidationError(name, result.issues, result.feedback);
    }
    if (!render) return JSON.stringify(result.data, null, 2);
    const m =
      outputType === "markdown" || outputType === "markdoc"
        ? contentBuilder(outputType)
        : undefined;
    // The definition's union already ties `render` to the builder for its outputType.
    return (render as Render<S, typeof m>)(result.data, m);
  }

  return {
    name,
    version,
    description,
    schema,
    getInfo,
    validateJson,
    jsonToString,
  };
}

const TYPE_NOUNS: Record<string, string> = {
  string: "a string",
  number: "a number",
  int: "a whole number",
  boolean: "true or false",
  array: "an array",
  object: "an object",
};

/**
 * Messages for issues a schema didn't word itself, in the same style as the
 * formats' own, like "each terms item must be an object". A schema's own
 * `error` takes precedence. Returning `undefined` keeps Zod's message.
 */
function defaultMessage(issue: z.core.$ZodRawIssue): string | undefined {
  const label = issueLabel(issue.path ?? []);
  switch (issue.code) {
    case "invalid_type": {
      const noun = TYPE_NOUNS[issue.expected];
      if (!noun) return undefined;
      return issue.input === undefined
        ? `${label} is required and must be ${noun}`
        : `${label} must be ${noun}`;
    }
    case "too_small":
    case "too_big": {
      const bound = issue.code === "too_small" ? "at least" : "at most";
      const limit = Number(
        issue.code === "too_small" ? issue.minimum : issue.maximum,
      );
      if (issue.origin === "string") {
        return issue.code === "too_small" && limit === 1
          ? `${label} must not be empty`
          : `${label} must be ${bound} ${limit} characters`;
      }
      if (issue.origin === "array")
        return `${label} must have ${bound} ${limit} ${limit === 1 ? "item" : "items"}`;
      return `${label} must be ${bound} ${limit}`;
    }
    case "invalid_value":
      return `${label} must be one of ${issue.values.map(String).join(", ")}`;
    case "unrecognized_keys": {
      const fields = issue.keys.map((key) => `\`${key}\``).join(", ");
      return `${label} has unknown ${issue.keys.length === 1 ? "field" : "fields"} ${fields}`;
    }
    default:
      return undefined;
  }
}

/** `["terms", 0, "end"]` → `each terms end`; `["terms", 0]` → `each terms item`. */
function issueLabel(path: PropertyKey[]): string {
  if (path.length === 0) return "the document";
  const groups: string[][] = [[]];
  for (const key of path) {
    if (typeof key === "number") groups.push([]);
    else groups.at(-1)!.push(String(key));
  }
  const name = groups
    .filter((group) => group.length > 0)
    .map((group) => group.join("."))
    .join(" ");
  if (groups.length === 1) return name;
  return `each ${name}${groups.at(-1)!.length === 0 ? " item" : ""}`;
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === "number") return `${acc}[${key}]`;
    const segment = String(key);
    return acc ? `${acc}.${segment}` : segment;
  }, "");
}

function buildInstructions(info: {
  name: string;
  version: number;
  description: string;
  jsonSchema: Record<string, unknown>;
  example: unknown;
}): string {
  const sections = [
    `# Output format: ${info.name} v${info.version}`,
    info.description,
    [
      "Produce a single JSON document that conforms to the JSON Schema below.",
      "Treat every `description` in the schema as a requirement, even when it",
      "cannot be checked automatically. Validate the document and fix every",
      "reported issue before treating it as final.",
    ].join(" "),
    "## JSON Schema",
    fence(info.jsonSchema),
  ];

  if (info.example !== undefined) {
    sections.push("## Example", fence(info.example));
  }

  return sections.join("\n\n");
}

function fence(value: unknown): string {
  return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
}
