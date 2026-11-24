import type { Format } from "../define-format.ts";
import { jiraCardDescription } from "./jira-card-description/index.ts";
import { jsPackageMigrationGuide } from "./js-package-migration-guide/index.ts";
import { presidentDescription } from "./president-description/index.ts";

// Register new formats here.
export const formats: readonly Format[] = [jiraCardDescription, jsPackageMigrationGuide, presidentDescription];

export function getFormat(name: string): Format {
  const format = formats.find((candidate) => candidate.name === name);
  if (!format) {
    const available = formats.map((candidate) => candidate.name).join(", ");
    throw new Error(`Unknown format "${name}". Available formats: ${available}`);
  }
  return format;
}

export { jiraCardDescription, jsPackageMigrationGuide, presidentDescription };
