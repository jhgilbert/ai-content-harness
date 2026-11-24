// Bundles each registered format into dist/standalone/<name>.js: one
// dependency-free file that runs with `node`, for use in places like Claude skills.
// Pass a directory to build somewhere else: `node scripts/build-standalone.ts <dir>`.
// Fails if a released version would change; see scripts/record-format-versions.ts.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { formats } from "../src/formats/index.ts";
import { bundleStandalone, readVersionLock, standaloneDir, standaloneFileName, versionProblem } from "./standalone.ts";

const outDir = resolve(process.argv[2] ?? standaloneDir);
const lock = readVersionLock();

const bundles = await Promise.all(formats.map(async (format) => ({ format, code: await bundleStandalone(format) })));
const problems = bundles.flatMap(({ format, code }) => versionProblem(format, code, lock) ?? []);
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
for (const { format, code } of bundles) {
  const file = resolve(outDir, standaloneFileName(format));
  await writeFile(file, code);
  console.log(relative(process.cwd(), file));
}
