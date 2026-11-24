#!/usr/bin/env node
import { isFormatCommand, runFormatCommand } from "./commands.ts";
import { formats, getFormat } from "./formats/index.ts";

const USAGE = `Usage:
  ai-content-harness list
  ai-content-harness info <format>
  ai-content-harness validate <format> [file]
  ai-content-harness render <format> [file]

Reads JSON from stdin when [file] is omitted or "-".
Exit codes: 0 success, 1 invalid document, 2 usage error.`;

function main(argv: string[]): number {
  const [command, formatName, file] = argv;

  if (command === "list") {
    for (const format of formats) {
      console.log(`${format.name}\tv${format.version}\t${format.description}`);
    }
    return 0;
  }

  if (!formatName || !isFormatCommand(command)) {
    console.error(USAGE);
    return 2;
  }

  let format;
  try {
    format = getFormat(formatName);
  } catch (error) {
    console.error((error as Error).message);
    return 2;
  }

  return runFormatCommand(format, command, file);
}

process.exitCode = main(process.argv.slice(2));
