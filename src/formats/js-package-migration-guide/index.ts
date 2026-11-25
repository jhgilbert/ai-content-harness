import { defineFormat } from "../../define-format.ts";
import { example } from "./example.ts";
import { render } from "./render.ts";
import { JsPackageMigrationGuideSchema } from "./schema.ts";

export const jsPackageMigrationGuide = defineFormat({
  name: "js-package-migration-guide",
  version: 2,
  description: "A guide for upgrading a JavaScript package to a new version.",
  outputType: "markdown",
  schema: JsPackageMigrationGuideSchema,
  example,
  render,
});

export type { JsPackageMigrationGuide, JsPackageMigrationGuideInput } from "./schema.ts";
