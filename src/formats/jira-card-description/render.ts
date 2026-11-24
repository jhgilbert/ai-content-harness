import {
  bulletList,
  document,
  heading,
  paragraph,
  strong,
  toMarkdown,
} from "../../markdoc-wrapper.ts";
import type { JiraCardDescription } from "./schema.ts";

export function render(data: JiraCardDescription): string {
  const { role, goal, benefit } = data.userStory;

  return toMarkdown(
    document(
      paragraph(strong(data.summary)),
      paragraph(`As a ${role}, I want to ${goal}, so that I can ${benefit}.`),
      heading(3, "Acceptance criteria"),
      bulletList(data.acceptanceCriteria),
      data.openQuestions.length > 0 && [
        heading(3, "Open questions"),
        bulletList(data.openQuestions),
      ],
    ),
  );
}
