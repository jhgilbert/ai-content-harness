import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bundleStandalone,
  readVersionLock,
  sha256,
  standaloneDir,
  standaloneFileName,
  versionProblem,
} from "../scripts/standalone.ts";
import { defineFormat } from "../src/define-format.ts";
import { formats } from "../src/formats/index.ts";
import { standaloneUsage } from "../src/standalone.ts";

/** The npm packages each bundle contains, whose licenses it must carry. */
const BUNDLED_PACKAGES: Record<string, string[]> = {
  "jira-card-description": ["zod", "@markdoc/markdoc"],
  "js-package-migration-guide": ["zod", "@markdoc/markdoc", "semver"],
  "linked-in-post": ["zod", "@markdoc/markdoc"],
  "president-description": ["zod", "@markdoc/markdoc"],
};

const licenseText = (dir: string) => readFileSync(join(dir, "LICENSE"), "utf8").trim();

let outDir: string;
const bundles = new Map<string, string>();

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "standalone-"));
  for (const format of formats) {
    const code = await bundleStandalone(format);
    bundles.set(format.name, code);
    writeFileSync(join(outDir, standaloneFileName(format)), code);
  }
}, 60_000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

/** Copies the bundle to a directory of its own, so nothing from the project can be resolved. */
function run(scriptName: string, args: string[], input?: string) {
  const dir = mkdtempSync(join(tmpdir(), "standalone-run-"));
  copyFileSync(join(outDir, scriptName), join(dir, scriptName));
  const result = spawnSync("node", [scriptName, ...args], {
    cwd: dir,
    input,
    encoding: "utf8",
  });
  rmSync(dir, { recursive: true, force: true });
  return result;
}

describe.each(formats)("standalone $name", (format) => {
  const scriptName = `${format.name}.js`;

  it("keeps the version out of the file name, so the file's URL stays the same", () => {
    expect(standaloneFileName(format)).toBe(scriptName);
  });

  it("is committed as it's built now, so the file on GitHub isn't stale", () => {
    const committed = join(standaloneDir, scriptName);
    const message = `${committed} is out of date. Run \`npm run build\` and commit the result.`;
    expect(existsSync(committed) && readFileSync(committed, "utf8") === bundles.get(format.name), message).toBe(true);
  });

  it("doesn't change a released version", () => {
    expect(versionProblem(format, bundles.get(format.name)!, readVersionLock())).toBeUndefined();
  });

  it("bundles the same way every time, so the lock's hash is stable", async () => {
    expect(sha256(await bundleStandalone(format))).toBe(sha256(bundles.get(format.name)!));
  });

  it("starts with a comment that explains how to use it", () => {
    const comment = standaloneUsage(format, scriptName)
      .split("\n")
      .map((line) => `// ${line}`.trimEnd())
      .join("\n");
    expect(bundles.get(format.name)!.startsWith(`#!/usr/bin/env node\n${comment}\n`)).toBe(true);
  });

  it("states its version on its own line in the comment", () => {
    expect(bundles.get(format.name)!.split("\n")).toContain(`// Version: ${format.version}`);
  });

  it("states its copyright and license in the comment", () => {
    const copyright = licenseText(".")
      .split("\n")
      .find((line) => line.startsWith("Copyright"));
    expect(bundles.get(format.name)!.split("\n")).toContain(`// ${copyright}. MIT License.`);
  });

  it("includes the full license of the project and of each bundled package", () => {
    const code = bundles.get(format.name)!;
    expect(code).toContain(licenseText("."));
    for (const name of BUNDLED_PACKAGES[format.name]!) {
      expect(code, name).toContain(licenseText(join("node_modules", name)));
    }
  });

  it("prints its version", () => {
    expect(run(scriptName, ["version"]).stdout).toBe(`${format.name} v${format.version}\n`);
  });

  it("prints the same instructions as the package", () => {
    expect(run(scriptName, ["info"]).stdout).toBe(`${format.getInfo().instructions}\n`);
  });

  it("renders the example the same way as the package", () => {
    const result = run(scriptName, ["render"], JSON.stringify(format.getInfo().example));
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(format.jsonToString(format.getInfo().example));
  });

  it("reports an invalid document with exit code 1", () => {
    const result = run(scriptName, ["validate", "-"], "{}");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Invalid ${format.name} v${format.version} document`);
  });

  it.each([[[]], [["help"]]])("prints usage with exit code 0 for %j, so AI can read it instead of the code", (args) => {
    const result = run(scriptName, args);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${standaloneUsage(format, scriptName)}\n`);
  });

  it("prints usage with exit code 2 for an unknown command", () => {
    const result = run(scriptName, ["nope"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(`node ${scriptName} render [file]`);
  });
});

it("commits no scripts for formats that no longer exist", () => {
  expect(readdirSync(standaloneDir).sort()).toEqual(formats.map(standaloneFileName).sort());
});

describe("versionProblem", () => {
  const format = (version: number) =>
    defineFormat({
      name: "notes",
      version,
      description: "",
      outputType: "json",
      schema: z.object({}),
    });
  const lock = { notes: { version: 2, sha256: sha256("released code") } };

  it("allows the released code", () => {
    expect(versionProblem(format(2), "released code", lock)).toBeUndefined();
  });

  it("rejects a change without a version bump", () => {
    expect(versionProblem(format(2), "changed code", lock)).toBe(
      "notes v2 has changed since it was released. Set version to 3 in src/formats/notes/index.ts.",
    );
  });

  it("allows changes to an unreleased version or format", () => {
    expect(versionProblem(format(3), "changed code", lock)).toBeUndefined();
    expect(versionProblem(format(1), "any code", {})).toBeUndefined();
  });

  it("rejects a version below the released one", () => {
    expect(versionProblem(format(1), "released code", lock)).toBe(
      "notes is v1, but v2 is already released. Versions can't go backwards.",
    );
  });
});
