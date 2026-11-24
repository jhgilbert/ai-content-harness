import { bulletList, document, heading, paragraph, table, toMarkdown } from "../../markdoc-wrapper.ts";
import type { PresidentDescription } from "./schema.ts";

type Term = PresidentDescription["terms"][number];

const PRONOUNS = {
  he: { subject: "He", was: "was" },
  she: { subject: "She", was: "was" },
  they: { subject: "They", was: "were" },
} as const;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const list = new Intl.ListFormat("en", { type: "conjunction" });

export function render(data: PresidentDescription): string {
  const pronoun = PRONOUNS[data.pronoun];
  const born = year(data.born);
  const numbers = list.format(data.numbers.map(ordinal));

  return toMarkdown(
    document(
      heading(1, data.name),
      heading(2, "Overview"),
      paragraph(`${data.name} was the ${numbers} president of the United States. ${data.summary}`),
      paragraph(
        data.died === undefined
          ? `${pronoun.subject} ${pronoun.was} born in ${born}.`
          : `${pronoun.subject} ${pronoun.was} born in ${born}, and ${pronoun.subject.toLowerCase()} died in ${year(data.died)}.`,
      ),
      heading(2, "Terms"),
      bulletList(data.terms.map(term)),
      heading(2, "Known for"),
      table(
        ["Achievement", "Description"],
        data.knownFor.map((item) => [item.name, item.description]),
      ),
      heading(2, "Timeline"),
      table(
        ["Year", "Event"],
        data.timeline.map((entry) => [String(entry.year), entry.event]),
      ),
    ),
  );
}

function term({ start, end, vicePresidents }: Term): string {
  const dates = end === undefined ? `Since ${longDate(start)}` : `${longDate(start)} to ${longDate(end)}`;
  if (vicePresidents.length === 0) return `${dates}, with no vice president`;
  const title = vicePresidents.length === 1 ? "vice president" : "vice presidents";
  return `${dates}, with ${list.format(vicePresidents)} as ${title}`;
}

/** `1789-04-30` → `April 30, 1789`. Parsed by hand so time zones can't shift the day. */
function longDate(iso: string): string {
  const [yyyy, mm, dd] = iso.split("-").map(Number);
  return `${MONTHS[mm! - 1]} ${dd}, ${yyyy}`;
}

function year(iso: string): number {
  return Number(iso.slice(0, 4));
}

/** 1 → `1st`, 12 → `12th`, 22 → `22nd`. */
function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const lastTwo = n % 100;
  return `${n}${suffixes[(lastTwo - 20) % 10] ?? suffixes[lastTwo] ?? suffixes[0]}`;
}
