import { document, paragraph, toMarkdown } from "../../markdoc-wrapper.ts";
import type { LinkedInPost } from "./schema.ts";

export function render(data: LinkedInPost): string {
  return toMarkdown(
    document(
      paragraph(
        `${data.timeframe}, I ${data.mundaneEvent}. I had an epiphany: ${data.epiphany}`,
      ),
      paragraph(`The lesson that most people miss? ${data.lesson}`),
      paragraph(`It's not ${data.whatDoesNotMatter} that matters. It's ${data.whatDoesMatter}.`),
      paragraph("Agree?"),
    ),
  );
}
