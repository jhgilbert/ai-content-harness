// Records each format's current version as released, so that any later change to
// its standalone script fails the build and tests until the version is bumped.
// Runs before `npm publish`. Commit format-versions.lock.json afterwards.
import { formats } from "../src/formats/index.ts";
import { bundleStandalone, readVersionLock, sha256, versionProblem, writeVersionLock } from "./standalone.ts";

const lock = readVersionLock();
const problems: string[] = [];
for (const format of formats) {
  const code = await bundleStandalone(format);
  const problem = versionProblem(format, code, lock);
  if (problem) problems.push(problem);
  else lock[format.name] = { version: format.version, sha256: sha256(code) };
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
writeVersionLock(lock);
console.log(formats.map((format) => `${format.name} v${format.version}`).join("\n"));
