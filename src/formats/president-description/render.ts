import type { ContentBuilder } from "../../content-builder.ts";
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

export function render(
  data: PresidentDescription,
  m: ContentBuilder<"markdoc">,
): string {
  const pronoun = PRONOUNS[data.pronoun];
  const born = year(data.born);
  const numbers = list.format(data.numbers.map(ordinal));

  return m.toMarkup(
    m.document(
      m.heading(1, data.name),
      m.heading(2, "Overview"),
      m.paragraph(
        `${data.name} was the ${numbers} president of the United States. ${data.summary}`,
      ),
      m.paragraph(
        data.died === undefined
          ? `${pronoun.subject} ${pronoun.was} born in ${born}.`
          : `${pronoun.subject} ${pronoun.was} born in ${born}, and ${pronoun.subject.toLowerCase()} died in ${year(data.died)}.`,
      ),
      m.heading(2, "Terms"),
      m.bulletList(data.terms.map(term)),
      m.heading(2, "Known for"),
      m.table(
        ["Achievement", "Description"],
        data.knownFor.map((item) => [item.name, item.description]),
      ),
      m.heading(2, "Timeline"),
      m.table(
        ["Year", "Event"],
        data.timeline.map((entry) => [String(entry.year), entry.event]),
      ),
    ),
  );
}

function term({ start, end, vicePresidents }: Term): string {
  const dates =
    end === undefined
      ? `Since ${longDate(start)}`
      : `${longDate(start)} to ${longDate(end)}`;
  if (vicePresidents.length === 0) return `${dates}, with no vice president`;
  const title =
    vicePresidents.length === 1 ? "vice president" : "vice presidents";
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
