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

/** One complete sentence, like `Don't let a stubbed toe stop you.` */
const sentence = (label: string, maxLength: number) =>
  plainText(label, maxLength)
    .regex(/^[A-Z0-9"']/, `${label} must start with a capital letter`)
    .regex(/\.$/, `${label} must end with a period`)
    .refine((text) => (text.match(/[.!?](\s|$)/g) ?? []).length === 1, `${label} must be exactly 1 sentence`);

/** Part of a generated sentence, like `stubbed my toe`. */
const fragment = (label: string, maxLength: number) =>
  plainText(label, maxLength)
    .regex(/^[a-z]/, `${label} must start with a lowercase letter, since it continues a sentence`)
    .regex(/[^.!?,;:]$/, `${label} must not end with punctuation, since the sentence continues after it`);

export const LinkedInPostSchema = z
  .object({
    timeframe: plainText("timeframe", 30)
      .regex(/^[A-Z]/, "timeframe must start with a capital letter, since it starts the post")
      .regex(/[^.!?,;:]$/, "timeframe must not end with punctuation; a comma is added for you")
      .describe("When it happened, like `Yesterday`, `A week ago`, or `Last month`. Rendered as `<timeframe>, I ...`."),
    mundaneEvent: fragment("mundaneEvent", 60).describe(
      "Something ordinary that happened, starting with a past-tense verb, like `stubbed my toe` or `vacuumed my rug`. Rendered as `I <mundaneEvent>.`",
    ),
    epiphany: sentence("epiphany", 150).describe(
      "The grand realization drawn from the mundane event, like `The greatest innovators of all time stubbed their toes just like the rest of us.` It follows `I had an epiphany: `.",
    ),
    lesson: sentence("lesson", 150).describe(
      "The takeaway for the reader, like `Don't let a stubbed toe make you feel less legendary.` It follows `The lesson that most people miss? `.",
    ),
    whatDoesNotMatter: fragment("whatDoesNotMatter", 80).describe(
      "The thing people wrongly focus on, like `how many times you stub your toe`. Rendered as `It's not <whatDoesNotMatter> that matters.`",
    ),
    whatDoesMatter: fragment("whatDoesMatter", 100).describe(
      "The thing that actually matters, like `what you do when you're not stubbing your toe`. Rendered as `It's <whatDoesMatter>.`",
    ),
  })
  .strict();

/** What Claude writes. */
export type LinkedInPostInput = z.input<typeof LinkedInPostSchema>;
/** What the renderer receives, after defaults are applied. */
export type LinkedInPost = z.output<typeof LinkedInPostSchema>;
