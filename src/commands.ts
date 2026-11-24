import type { Format } from "./define-format.ts";

export const FORMAT_COMMANDS = ["info", "validate", "render"] as const;
export type FormatCommand = (typeof FORMAT_COMMANDS)[number];

export function isFormatCommand(command: string | undefined): command is FormatCommand {
  return (FORMAT_COMMANDS as readonly (string | undefined)[]).includes(command);
}

// `getBuiltinModule` instead of `import ... from "node:fs"` keeps the standalone
// bundles free of import and require statements, so they run as either an ES
// module or a CommonJS script, wherever they're copied.
function readInput(file: string | undefined): string {
  const { readFileSync } = process.getBuiltinModule("node:fs");
  return readFileSync(file && file !== "-" ? file : 0, "utf8");
}

/** Runs one command against one format and returns the exit code. */
export function runFormatCommand(format: Format, command: FormatCommand, file: string | undefined): number {
  if (command === "info") {
    console.log(format.getInfo().instructions);
    return 0;
  }

  const result = format.validateJson(readInput(file));
  if (!result.success) {
    console.error(`Invalid ${format.name} v${format.version} document:\n${result.feedback}`);
    return 1;
  }

  if (command === "validate") {
    console.log(`Valid ${format.name} v${format.version} document.`);
  } else {
    process.stdout.write(format.jsonToString(result.data));
  }
  return 0;
}
