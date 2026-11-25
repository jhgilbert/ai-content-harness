import type { ContentBuilder } from "../../content-builder.ts";
import type { JsPackageMigrationGuide } from "./schema.ts";

type CodeExample = JsPackageMigrationGuide["codeExamples"][number];

export function render(
  data: JsPackageMigrationGuide,
  m: ContentBuilder<"markdoc">,
): string {
  const release = m.code(`${data.packageName}@${data.version}`);
  const version = m.code(data.version);
  const prerequisiteNodes = prerequisites(data, m);

  return m.toMarkup(
    m.document(
      m.heading(1, "Migrate to ", release),
      m.heading(2, "Overview"),
      m.paragraph(
        "This guide contains instructions for upgrading to ",
        release,
        ".",
      ),
      m.heading(2, "What's new in ", version),
      changeTable(m, "Feature", data.whatsNew),
      data.breakingChanges.length > 0 && [
        m.heading(2, "Breaking changes in ", version),
        changeTable(m, "Change", data.breakingChanges),
      ],
      (prerequisiteNodes || data.codeExamples.length > 0) && [
        m.heading(2, "Upgrade instructions"),
        prerequisiteNodes,
        data.codeExamples.map((example) => codeExample(example, m)),
      ],
    ),
  );
}

function prerequisites(
  data: JsPackageMigrationGuide,
  m: ContentBuilder<"markdoc">,
) {
  const minimum = data.prerequisites.minimumVersion;
  if (!minimum) return undefined;

  const release = m.code(`${data.packageName}@${minimum.version}`);
  return [
    m.heading(3, "Prerequisites"),
    m.paragraph(
      "You must be on ",
      release,
      " or newer.",
      minimum.guideUrl && [
        " To upgrade to ",
        release,
        " first, see the ",
        m.link(minimum.guideUrl, "migration guide for ", release),
        ".",
      ],
    ),
  ];
}

function codeExample(example: CodeExample, m: ContentBuilder<"markdoc">) {
  const snippet =
    example.after === undefined
      ? example.before
      : `// Before\n${example.before}\n\n// After\n${example.after}`;
  return [
    m.heading(3, ...exampleHeading(example, m)),
    m.paragraph(m.inlineMarkdown(example.reason)),
    m.fence(example.language, snippet),
  ];
}

function exampleHeading(example: CodeExample, m: ContentBuilder<"markdoc">) {
  switch (example.action) {
    case "replace":
      return ["Replace ", m.code(example.from), " with ", m.code(example.to)];
    case "rename":
      return ["Rename ", m.code(example.from), " to ", m.code(example.to)];
    case "move":
      return [
        "Import ",
        m.code(example.api),
        " from ",
        m.code(example.toModule),
      ];
    case "remove":
      return ["Remove ", m.code(example.api)];
    case "update":
      return ["Update uses of ", m.code(example.api)];
  }
}

function changeTable(
  m: ContentBuilder<"markdoc">,
  nameHeader: string,
  changes: JsPackageMigrationGuide["whatsNew"],
) {
  return m.table(
    [nameHeader, "Description"],
    changes.map((change) => [
      m.inlineMarkdown(change.name),
      m.inlineMarkdown(change.description),
    ]),
  );
}
