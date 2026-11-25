import { z } from "zod";

// Custom messages matter: they are the feedback Claude reads when it retries.
export const JiraCardDescriptionSchema = z
  .object({
    summary: z
      .string()
      .min(10, "summary must be at least 10 characters")
      .max(80, "summary must be at most 80 characters")
      .regex(/[^.]$/, "summary must not end with a period")
      .describe("One sentence stating the change from the user's point of view."),
    userStory: z
      .object({
        role: z
          .string()
          .min(1)
          .describe("Who benefits, e.g. `workspace admin`. No leading article."),
        goal: z
          .string()
          .min(1)
          .describe("What they want to do, starting with a verb."),
        benefit: z
          .string()
          .min(1)
          .describe("Why it matters to them, starting with a verb."),
      })
      .describe("Rendered as: As a <role>, I want to <goal>, so that I can <benefit>."),
    acceptanceCriteria: z
      .array(
        z
          .string()
          .regex(
            /^Given .+, when .+, then .+\.$/,
            "each acceptance criterion must follow `Given ..., when ..., then ....`",
          ),
      )
      .min(1, "include at least 1 acceptance criterion")
      .max(6, "include at most 6 acceptance criteria")
      .describe("Testable outcomes in Given/When/Then form."),
    openQuestions: z
      .array(z.string().endsWith("?", "each open question must end with `?`"))
      .max(4, "include at most 4 open questions")
      .default([])
      .describe("Unresolved questions for the team. Omit if there are none."),
  })
  .strict();

/** What Claude writes. */
export type JiraCardDescriptionInput = z.input<typeof JiraCardDescriptionSchema>;
/** What the renderer receives, after defaults are applied. */
export type JiraCardDescription = z.output<typeof JiraCardDescriptionSchema>;
