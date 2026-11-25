import { defineFormat } from "../../define-format.ts";
import { example } from "./example.ts";
import { render } from "./render.ts";
import { schema } from "./schema.ts";

export const linkedInPost = defineFormat({
  name: "linked-in-post",
  version: 1,
  description:
    "A tongue-in-cheek LinkedIn post that turns a mundane event into an entrepreneurial epiphany and a lesson for the reader.",
  outputType: "markdown",
  schema,
  example,
  render,
});

export type { LinkedInPost, LinkedInPostInput } from "./schema.ts";
