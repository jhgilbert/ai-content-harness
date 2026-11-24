# Working on ai-content-harness

Each format in `src/formats/` is a Zod schema plus a renderer. AI writes a JSON document, validates it against the schema, and the renderer turns the valid document into the final content. `npm run build` bundles each format into a standalone script in `dist/standalone/`.

## Commands

```sh
npm test                 # vitest
npm run typecheck
npm run build            # emits dist/, including dist/standalone/
npm run versions:record  # mark the current format versions as released
npm run cli -- list      # run the CLI from source (Node >= 22.18)
npx prettier --check .   # formatting
```

Before you finish a change, run `npm test`, `npm run typecheck`, and `npx prettier --check` on the files you changed.

## Format API

Each format, such as [president-description](./src/formats/president-description/), is built with `defineFormat()` and has these functions:

- `getInfo()` describes the JSON document the AI should build. For example, the document for describing a president includes the president's date of birth.
- `validateJson(input)` validates the JSON object that the AI created.
- `jsonToString(input)` validates, then renders to the final format (for example Markdown). A format whose `outputType` is `json` can omit `render`, and then emits pretty-printed JSON.

## Format guidelines

When possible, a format should avoid prose in the JSON, instead templating smaller pieces of data (such as names, dates, and so on) into deterministic strings. For example, if the user's desired template contains "He was born in 1961", make sure the user intends for this sentence to always appear in the content, in which case it could be templated from just the year `1961` in the JSON for better control over the final result.

Sometimes, prose is expected. For example, in a format for a Jira card description, a short run of prose in an `issueSummary` JSON entry would make sense. Similarly, for a bulleted list, each bullet might contain freeform prose. When prose is allowed in JSON, add a logical length limit or ask the user what the length limit should be. It would not make sense for an `issueSummary` to be 10000 characters long, for example. A bullet should probably not be ten sentences long either. Err on the side of enforcing brevity.

For `plaintext`, `markdown`, and `markdoc` content, it's preferred to use the Markdoc wrapper in `markdoc-wrapper.ts` for templating, rather than string concatenation or a templating language like Liquid. Plaintext should of course only use components like `paragraph`, since formatted items such as links should not appear in plaintext.

## Adding or changing a format

Each format lives in its own folder, with one file per role:

```
src/formats/<name>/
  schema.ts   # the Zod schema, plus input/output types
  example.ts  # a valid sample document (optional)
  render.ts   # templates validated data to the final string (optional for JSON output)
  index.ts    # rolls the pieces up with defineFormat()
```

1. Write the target output first, in `test/format-snapshots/<name>.<ext>`. The extension depends on the format's `outputType`: `.txt` for `plaintext`, `.md` for `markdown`, `.html` for `html`, `.mdoc` for `markdoc`, and `.json` for `json`. Snapshots are the spec: change the code to match the snapshot, not the other way around. Run `npm test` and confirm that the test fails before you implement.
2. Create the folder and files above. Pass `version: 1` and an `outputType` (one of `plaintext`, `markdown`, `html`, `markdoc`, or `json`) to `defineFormat()`. `render` is required unless `outputType` is `json`. The folder name must match the format `name`.
3. Register the format in `src/formats/index.ts`.
4. `npm test` checks that every registered example validates and renders to its snapshot. Run `npm test -- -u` only when the user has approved the new rendered output.

Don't run Prettier on `test/format-snapshots/`. Snapshots must match the renderer's output exactly, so `.prettierignore` excludes them.

### Schema guidelines

- Name Zod schema constants with a `Schema` suffix, like `PersonSchema`, not `person`.
- Give every check a custom message. The message is the feedback the AI reads when it retries.
- Use `.describe()` for intent, including rules Zod can't express in JSON Schema (`.refine()` checks don't appear there).

## Standalone scripts

`npm run build` bundles each format into `dist/standalone/<name>.js`. Each file has no dependencies and runs with Node 22.18 or newer. The file name never includes the version, so links to it don't break. The version is on the `// Version:` line of the comment at the top, which `standaloneUsage()` in `src/standalone.ts` generates.

The scripts in `dist/standalone/` are committed. After any change that affects a bundle, run `npm run build` and include the rebuilt scripts. `npm test` fails if a committed script is stale, or if a script exists for a format that's no longer registered.

## Versions

`format-versions.lock.json` records a hash of each released version's script. If anything changes what a released version's script contains, `npm test` and `npm run build` fail until you bump `version` in the format's `index.ts`. That includes the schema, the renderer, the example, the description, shared code, and dependencies.

A format that isn't in the lock, or whose version is newer than its entry, is unreleased, so you can change it freely. `npm publish` runs `npm run versions:record` to mark the current versions as released, and the updated lock file must then be committed. Don't delete a lock entry to avoid a version bump unless the user confirms that nobody has used that version.
