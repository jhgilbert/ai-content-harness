import type { MarkdownBuilder } from "../../content-builder.ts";
import type { LinkedInPost } from "./schema.ts";

export function render(data: LinkedInPost, m: MarkdownBuilder): string {
  return m.toMarkdown(
    m.document(
      m.paragraph(
        `${data.timeframe}, I ${data.mundaneEvent}. I had an epiphany: ${data.epiphany}`,
      ),
      m.paragraph(`The lesson that most people miss? ${data.lesson}`),
      m.paragraph(
        `It's not ${data.whatDoesNotMatter} that matters. It's ${data.whatDoesMatter}.`,
      ),
      m.paragraph("Agree?"),
    ),
  );
}
