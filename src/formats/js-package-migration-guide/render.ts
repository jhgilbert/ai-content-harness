import {
  code,
  document,
  fence,
  heading,
  inlineMarkdown,
  link,
  paragraph,
  table,
  toMarkdown,
} from "../../markdoc-wrapper.ts";
import type { JsPackageMigrationGuide } from "./schema.ts";

type CodeExample = JsPackageMigrationGuide["codeExamples"][number];

export function render(data: JsPackageMigrationGuide): string {
  const release = code(`${data.packageName}@${data.version}`);
  const version = code(data.version);
  const prerequisiteNodes = prerequisites(data);

  return toMarkdown(
    document(
      heading(1, "Migrate to ", release),
      heading(2, "Overview"),
      paragraph("This guide contains instructions for upgrading to ", release, "."),
      heading(2, "What's new in ", version),
      changeTable("Feature", data.whatsNew),
      data.breakingChanges.length > 0 && [
        heading(2, "Breaking changes in ", version),
        changeTable("Change", data.breakingChanges),
      ],
      (prerequisiteNodes || data.codeExamples.length > 0) && [
        heading(2, "Upgrade instructions"),
        prerequisiteNodes,
        data.codeExamples.map(codeExample),
      ],
    ),
  );
}

function prerequisites(data: JsPackageMigrationGuide) {
  const minimum = data.prerequisites.minimumVersion;
  if (!minimum) return undefined;

  const release = code(`${data.packageName}@${minimum.version}`);
  return [
    heading(3, "Prerequisites"),
    paragraph(
      "You must be on ",
      release,
      " or newer.",
      minimum.guideUrl && [
        " To upgrade to ",
        release,
        " first, see the ",
        link(minimum.guideUrl, "migration guide for ", release),
        ".",
      ],
    ),
  ];
}

function codeExample(example: CodeExample) {
  const snippet =
    example.after === undefined
      ? example.before
      : `// Before\n${example.before}\n\n// After\n${example.after}`;
  return [
    heading(3, ...exampleHeading(example)),
    paragraph(inlineMarkdown(example.reason)),
    fence(example.language, snippet),
  ];
}

function exampleHeading(example: CodeExample) {
  switch (example.action) {
    case "replace":
      return ["Replace ", code(example.from), " with ", code(example.to)];
    case "rename":
      return ["Rename ", code(example.from), " to ", code(example.to)];
    case "move":
      return ["Import ", code(example.api), " from ", code(example.toModule)];
    case "remove":
      return ["Remove ", code(example.api)];
    case "update":
      return ["Update uses of ", code(example.api)];
  }
}

function changeTable(nameHeader: string, changes: JsPackageMigrationGuide["whatsNew"]) {
  return table(
    [nameHeader, "Description"],
    changes.map((change) => [inlineMarkdown(change.name), inlineMarkdown(change.description)]),
  );
}
