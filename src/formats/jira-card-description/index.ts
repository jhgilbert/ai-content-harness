import { defineFormat } from "../../define-format.ts";
import { example } from "./example.ts";
import { render } from "./render.ts";
import { schema } from "./schema.ts";

export const jiraCardDescription = defineFormat({
  name: "jira-card-description",
  version: 2,
  description:
    "The description field of a Jira story card: a summary, a user story, acceptance criteria, and open questions.",
  outputType: "markdown",
  schema,
  example,
  render,
});

export type { JiraCardDescription, JiraCardDescriptionInput } from "./schema.ts";
