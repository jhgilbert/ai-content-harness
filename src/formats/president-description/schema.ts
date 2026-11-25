import { z } from "zod";
import { inlineMarkdownProblems } from "../../content-builder.ts";

/** One line of plain text, with no Markdown formatting. */
const plainText = (label: string, maxLength: number) =>
  z
    .string({ error: `${label} is required and must be a string` })
    .min(1, `${label} must not be empty`)
    .max(maxLength, `${label} must be at most ${maxLength} characters`)
    .superRefine((text, ctx) => {
      for (const problem of inlineMarkdownProblems(text, [])) {
        ctx.addIssue({ code: "custom", message: `${label} ${problem}` });
      }
    });

/** A table cell or list fragment, which reads best without a trailing period. */
const fragment = (label: string, maxLength: number) =>
  plainText(label, maxLength).regex(/[^.]$/, `${label} must not end with a period`);

const date = (label: string) =>
  z.iso.date({
    error: `${label} must be a real date written as YYYY-MM-DD, like \`1732-02-22\``,
  });

const MAX_SUMMARY_LENGTH = 300;

const PersonSchema = z
  .object({
    name: plainText("name", 60).describe("The president's name as commonly written, like `George Washington`."),
    pronoun: z
      .enum(["he", "she", "they"], {
        error: "pronoun must be one of he, she, they",
      })
      .describe("The pronoun the renderer uses in generated sentences."),
    numbers: z
      .array(
        z.int({ error: "each numbers item must be a whole number" }).min(1, "each numbers item must be at least 1"),
      )
      .min(1, "include at least 1 number")
      .max(2, "include at most 2 numbers")
      .describe(
        "Where the president falls in order, like `[1]` for the 1st president. Use two numbers only for non-consecutive terms, like `[22, 24]`.",
      ),
    summary: plainText("summary", MAX_SUMMARY_LENGTH)
      .regex(/\.$/, "summary must end with a period")
      .refine((text) => (text.match(/[.!?](\s|$)/g) ?? []).length <= 2, "summary must be at most 2 sentences")
      .describe(
        "One or two sentences on what the president is most known for, like `He led the Continental Army to victory.` It follows a generated sentence naming the president and their number, so don't repeat those.",
      ),
    born: date("born").describe("Date of birth, like `1732-02-22`, using the modern (Gregorian) calendar."),
    died: date("died").optional().describe("Date of death. Omit it if the president is alive."),
    terms: z
      .array(
        z
          .object({
            start: date("each terms start").describe("The day the term began."),
            end: date("each terms end")
              .optional()
              .describe("The day the term ended. Omit it only for a term still in progress."),
            vicePresidents: z
              .array(plainText("each vicePresidents item", 60))
              .max(3, "include at most 3 vicePresidents per term")
              .describe("Everyone who served as vice president during the term, in order. Empty if there was none."),
          })
          .strict(),
      )
      .min(1, "include at least 1 term")
      .max(4, "include at most 4 terms")
      .describe("Each term served, oldest first, rendered as a bulleted list."),
    knownFor: z
      .array(
        z
          .object({
            name: fragment("each knownFor name", 30).describe("A short name, like `Farewell Address`."),
            description: fragment("each knownFor description", 130).describe(
              "What the president did, starting with a past-tense verb, like `Warned against political parties in 1796`.",
            ),
          })
          .strict(),
      )
      .min(1, "include at least 1 knownFor item")
      .max(6, "include at most 6 knownFor items")
      .describe("The president's best-known achievements, most important first, rendered as a table."),
    timeline: z
      .array(
        z
          .object({
            year: z.int({ error: "each timeline year must be a whole number" }),
            event: fragment("each timeline event", 100).describe(
              "What happened, starting with a past-tense verb, like `Died at Mount Vernon`.",
            ),
          })
          .strict(),
      )
      .min(3, "include at least 3 timeline events")
      .max(12, "include at most 12 timeline events")
      .describe("Key events in the president's life, oldest first, from birth to death, rendered as a table."),
  })
  .strict();

export const PresidentDescriptionSchema = PersonSchema.superRefine((data, ctx) => {
  checkLifespan(data, ctx);
  checkTerms(data, ctx);
  checkTimeline(data, ctx);
});

type President = z.output<typeof PersonSchema>;

// ISO dates compare correctly as strings, so none of these checks parse them.
// A malformed date already has its own issue, so skip comparisons that use one.
const IsoDateSchema = z.iso.date();
const isDate = (value: string | undefined): value is string => value !== undefined && IsoDateSchema.safeParse(value).success;

function checkLifespan(data: President, ctx: z.RefinementCtx) {
  if (isDate(data.died) && isDate(data.born) && data.died <= data.born) {
    ctx.addIssue({
      code: "custom",
      path: ["died"],
      message: `died must be after born (${data.born})`,
    });
  }
  data.numbers.forEach((number, index) => {
    if (index > 0 && number <= data.numbers[index - 1]!) {
      ctx.addIssue({
        code: "custom",
        path: ["numbers", index],
        message: "numbers must be in increasing order",
      });
    }
  });
}

function checkTerms(data: President, ctx: z.RefinementCtx) {
  data.terms.forEach((term, index) => {
    const issue = (field: "start" | "end", message: string) =>
      ctx.addIssue({ code: "custom", path: ["terms", index, field], message });
    const previous = data.terms[index - 1];

    if (isDate(term.start) && isDate(data.born) && term.start <= data.born)
      issue("start", `each terms start must be after born (${data.born})`);
    if (previous?.end !== undefined && isDate(previous.end) && isDate(term.start) && term.start < previous.end) {
      issue("start", `each terms start must not be before the previous term's end (${previous.end})`);
    }
    if (term.end === undefined) {
      if (data.died !== undefined) issue("end", "each terms end is required when died is set");
      else if (index < data.terms.length - 1) issue("end", "each terms end is required except on the last term");
      return;
    }
    if (isDate(term.start) && isDate(term.end) && term.end <= term.start)
      issue("end", `each terms end must be after its start (${term.start})`);
    if (isDate(data.died) && isDate(term.end) && term.end > data.died) {
      issue("end", `each terms end must not be after died (${data.died})`);
    }
  });
}

function checkTimeline(data: President, ctx: z.RefinementCtx) {
  if (!isDate(data.born)) return;
  const first = Number(data.born.slice(0, 4));
  const last = isDate(data.died) ? Number(data.died.slice(0, 4)) : undefined;
  data.timeline.forEach((entry, index) => {
    const issue = (message: string) =>
      ctx.addIssue({
        code: "custom",
        path: ["timeline", index, "year"],
        message,
      });
    if (entry.year < first || (last !== undefined && entry.year > last)) {
      issue(`each timeline year must be within the president's life (${first}–${last ?? "present"})`);
    }
    if (index > 0 && entry.year < data.timeline[index - 1]!.year) {
      issue("timeline events must be in order, oldest first");
    }
  });
}

/** What Claude writes. */
export type PresidentDescriptionInput = z.input<typeof PresidentDescriptionSchema>;
/** What the renderer receives, after defaults are applied. */
export type PresidentDescription = z.output<typeof PresidentDescriptionSchema>;
