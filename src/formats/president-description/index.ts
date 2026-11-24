import { defineFormat } from "../../define-format.ts";
import { example } from "./example.ts";
import { render } from "./render.ts";
import { schema } from "./schema.ts";

export const presidentDescription = defineFormat({
  name: "president-description",
  version: 1,
  description: "A profile of a president of the United States: terms, achievements, and a timeline of their life.",
  outputType: "markdown",
  schema,
  example,
  render,
});

export type { PresidentDescription, PresidentDescriptionInput } from "./schema.ts";
