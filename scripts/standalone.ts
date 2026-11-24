import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { rolldown } from "rolldown";
import type { Format } from "../src/define-format.ts";
import { standaloneUsage } from "../src/standalone.ts";

const root = resolve(import.meta.dirname, "..");
const entryPrefix = "\0standalone:";

export const versionLockPath = resolve(root, "format-versions.lock.json");

/** Where the build writes the standalone scripts. They're committed, so they can be linked to. */
export const standaloneDir = resolve(root, "dist/standalone");

/** The released version of each format, and a hash of its standalone script. */
export type VersionLock = Record<string, { version: number; sha256: string }>;

export function standaloneFileName(format: Format): string {
  return `${format.name}.js`;
}

/** Bundles one format, with its dependencies, into a single script. */
export async function bundleStandalone(format: Format): Promise<string> {
  const fileName = standaloneFileName(format);
  // Each bundle imports only its own format folder, so it doesn't carry the others.
  const entry = `
    import * as formatModule from ${JSON.stringify(resolve(root, "src/formats", format.name, "index.ts"))};
    import { runStandalone } from ${JSON.stringify(resolve(root, "src/standalone.ts"))};
    const format = Object.values(formatModule).find((value) => value?.name === ${JSON.stringify(format.name)});
    process.exitCode = runStandalone(format, ${JSON.stringify(fileName)}, process.argv.slice(2));
  `;
  const comment = [
    ...standaloneUsage(format, fileName).split("\n"),
    "",
    `${copyrightLine()}. MIT License.`,
    "The full license, and the licenses of the packages bundled here, are at the end of this file.",
  ];
  const banner = ["#!/usr/bin/env node", ...comment.map((line) => `// ${line}`.trimEnd())].join("\n");

  const bundle = await rolldown({
    input: entryPrefix + format.name,
    platform: "node",
    plugins: [
      {
        name: "standalone-entry",
        resolveId: (id) => (id.startsWith(entryPrefix) ? id : undefined),
        load: (id) => (id.startsWith(entryPrefix) ? entry : undefined),
      },
    ],
    logLevel: "warn",
  });
  try {
    // Added after minifying, which would strip the comment.
    const { output } = await bundle.generate({ format: "iife", minify: true });
    return `${banner}\n${output[0].code}${licenseNotice(output[0].moduleIds)}`;
  } finally {
    await bundle.close();
  }
}

/** The `Copyright (c) ...` line from the project's LICENSE. */
function copyrightLine(): string {
  const line = readLicense(root)
    .split("\n")
    .find((text) => text.startsWith("Copyright"));
  if (!line) throw new Error("LICENSE has no Copyright line");
  return line;
}

function readLicense(dir: string): string {
  const file = readdirSync(dir).find((name) => /^licen[cs]e(\.|$)/i.test(name));
  if (!file) throw new Error(`${dir} has no LICENSE file, so its license can't be included in the standalone scripts`);
  return readFileSync(join(dir, file), "utf8").trim();
}

/** `/a/node_modules/@scope/pkg/dist/x.js` → `/a/node_modules/@scope/pkg`. */
function packageDir(moduleId: string): string | undefined {
  const marker = "/node_modules/";
  const index = moduleId.lastIndexOf(marker);
  if (index === -1) return undefined;
  const parts = moduleId.slice(index + marker.length).split("/");
  return moduleId.slice(0, index + marker.length) + parts.slice(0, parts[0]!.startsWith("@") ? 2 : 1).join("/");
}

/**
 * A comment with the full license of this project and of each package in the
 * bundle. MIT and ISC require the notice to travel with every copy, and the
 * scripts are meant to be copied on their own.
 */
function licenseNotice(moduleIds: string[]): string {
  const dirs = [...new Set(moduleIds.map(packageDir).filter((dir) => dir !== undefined))];
  const packages = dirs
    .map((dir) => {
      const { name, version } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      return { title: `${name} ${version}`, license: readLicense(dir) };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  const sections = [{ title: "ai-content-harness", license: readLicense(root) }, ...packages].map(
    ({ title, license }) => `${title}\n\n${license}`,
  );
  // A `*/` in a license would end the comment early.
  return `\n/*\nLicenses\n\n${sections.join("\n\n---\n\n").replaceAll("*/", "* /")}\n*/\n`;
}

export function sha256(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function readVersionLock(): VersionLock {
  return JSON.parse(readFileSync(versionLockPath, "utf8")) as VersionLock;
}

export function writeVersionLock(lock: VersionLock): void {
  const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(versionLockPath, `${JSON.stringify(sorted, null, 2)}\n`);
}

/**
 * Why `code` can't ship as `format`'s current version. A format missing from the
 * lock, or newer than its entry, is unreleased and may change freely.
 */
export function versionProblem(format: Format, code: string, lock: VersionLock): string | undefined {
  const recorded = lock[format.name];
  if (!recorded) return undefined;
  if (format.version < recorded.version) {
    return `${format.name} is v${format.version}, but v${recorded.version} is already released. Versions can't go backwards.`;
  }
  if (format.version === recorded.version && sha256(code) !== recorded.sha256) {
    return `${format.name} v${format.version} has changed since it was released. Set version to ${format.version + 1} in src/formats/${format.name}/index.ts.`;
  }
  return undefined;
}
