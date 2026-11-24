import { isFormatCommand, runFormatCommand } from "./commands.ts";
import type { Format } from "./define-format.ts";

/** Shown when the script runs without a command, and as a comment at the top of the script. */
export function standaloneUsage(format: Format, script: string): string {
  return `${format.name}: ${format.description}
Version: ${format.version}

Usage:
  node ${script} info              print instructions, JSON Schema, and an example
  node ${script} validate [file]   check a JSON document
  node ${script} render [file]     validate, then print the rendered output
  node ${script} version           print the format version
  node ${script} help              print this message

You don't need to read this script's code. \`node ${script} help\` prints these instructions.

To produce a document, read the output of info, write the JSON, and run validate
until it succeeds. Then run render to get the final output.

Reads JSON from stdin when [file] is omitted or "-".
Exit codes: 0 success, 1 invalid document, 2 usage error.
Requires Node.js 22.18 or newer. Has no other dependencies.`;
}

/** The CLI for a single-format bundle: `node <script> <command> [file]`. */
export function runStandalone(format: Format, script: string, argv: string[]): number {
  const [command, file] = argv;

  if (command === "version") {
    console.log(`${format.name} v${format.version}`);
    return 0;
  }

  if (command === undefined || command === "help") {
    console.log(standaloneUsage(format, script));
    return 0;
  }

  if (!isFormatCommand(command)) {
    console.error(standaloneUsage(format, script));
    return 2;
  }

  return runFormatCommand(format, command, file);
}
