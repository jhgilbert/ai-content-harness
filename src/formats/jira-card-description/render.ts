import type { ContentBuilder } from "../../content-builder.ts";
import type { JiraCardDescription } from "./schema.ts";

export function render(
  data: JiraCardDescription,
  m: ContentBuilder<"markdown">,
): string {
  const { role, goal, benefit } = data.userStory;

  return m.toMarkup(
    m.document(
      m.paragraph(m.strong(data.summary)),
      m.paragraph(`As a ${role}, I want to ${goal}, so that I can ${benefit}.`),
      m.heading(3, "Acceptance criteria"),
      m.bulletList(data.acceptanceCriteria),
      data.openQuestions.length > 0 && [
        m.heading(3, "Open questions"),
        m.bulletList(data.openQuestions),
      ],
    ),
  );
}
