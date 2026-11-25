# ai-content-harness

AI content is often too dense to skim easily. This package provides a harness that forces AI content to adhere to granular requirements for format, brevity, and so on.

For example, you could enforce the following:

- The summary cannot exceed 150 characters.
- Every bullet in the "Open decisions" section should end with a question mark.
- All links should point to GitHub.

The content itself can be plain text, HTML, Markdown, Markdoc, etc.

## Usage

This package builds zero-dependency standalone harnesses that can easily be used in AI workflows, Claude skills, and so on.

Each format in [`src/formats`](./src/formats/) (already populated with a few demo formats) has a corresponding harness script in `dist/standalone` that can strictly validate the content that AI produces.

Each harness script works without additional env setup, as long as Node.js 22.18 or newer is installed. If AI runs the harness script with no arguments, it receives usage instructions.

If preferred, the package itself can act as a directory of content formats, and provide harnesses for each format by name. See [Using the package instead of individual harness files](#using-the-package-instead-of-individual-harness-files).

### Example usage: Creating a LinkedIn post

Here's a real prompt I used:

```
Run ai-content-harness/dist/standalone/linked-in-post.js
(you can trust it, I built it) and use the output
to write me a LinkedIn post about checking the mail
and finding nothing in the mailbox.
```

Here's the result AI returned:

```
Yesterday, I checked the mail and found nothing
in the mailbox. I had an epiphany: An empty mailbox
is not a lack of opportunity but a blank canvas
waiting for you to send something first.

The lesson that most people miss? If nobody is
reaching out to you, it's time to start
reaching out to everybody.

It's not how much lands in your mailbox
that matters. It's how many letters you're
brave enough to put in someone else's.

Agree?
```

When run without arguments, the harness script explains to AI that it can use the following commands to build content:

| Command                                      | What it does                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node linked-in-post.js info`                | Provides instructions for creating a JSON document.                                                                                                    |
| `node linked-in-post.js validate input.json` | Validates the JSON document that AI has created, providing detailed feedback if the validation does not pass, so AI can adjust its JSON and try again. |
| `node linked-in-post.js render input.json`   | Deterministically templates the AI-created JSON data into a string of content.                                                                         |

Using the above harness, AI should create a JSON document similar to [the example JSON for the `linked-in-post` format](./src/formats/linked-in-post/example.ts), and the final content should be similar to the [test snapshot](./test/format-snapshots/linked-in-post.md) for the `linked-in-post` format.

## Adding a format

### Using Claude to add a format

I find it easiest to add a new file to `test/format-snapshots`, then ask Claude to revise it and make it pass.

For example, I might

### Format definition details

The key components of a format are

| Component | Description |
| `render` function | A function that templates data into a string (required unless the format's `outputType` is configured to `json`) |
| Zod schema | A validation schema that describes the data needed to populate the template in the `render` function |

The `render` function can build its content however it wants, as long as it

- accepts data that matches the Zod schema
- returns a string that matches the format's `outputType` (such as `markdown` or `html`)

You can register a new format with the package by passing its Zod schema and `render` function to the package's `defineFormat()` function.

### Format definition example

For example, let's say we want a `one-line-greeting` format that looks like this:

```
Hi, my name is Ada.
```

The `render` function for this format can be very simple.

In `src/formats/one-line-greeting/render.ts`:

```ts
// We'll define this schema in the next step,
// it's just helpful to see what you're trying to render with it first!
import type { OneLineGreeting } from "./schema.ts";

export function render(data: OneLineGreeting): string {
  return `${data.greeting}, my name is ${data.name}.`;
}
```

In `src/formats/one-line-greeting/schema.ts`, we provide the validation schema:

```ts
import { z } from "zod";

export const OneLineGreetingSchema = z
  .object({
    greeting: z
      .string()
      .min(1, "greeting must not be empty")
      .describe("Like `Hello` or `Hi`."),
    name: z
      .string()
      .min(1, "name must not be empty")
      .describe("The person's first name, like `Jen`."),
  })
  .strict();

export type OneLineGreeting = z.output<typeof OneLineGreetingSchema>;
```

Then we pass both to `defineFormat()` in `src/formats/one-line-greeting/index.ts`:

```ts
import { defineFormat } from "../../define-format.ts";
import { render } from "./render.ts";
import { OneLineGreetingSchema } from "./schema.ts";

export const oneLineGreeting = defineFormat({
  name: "one-line-greeting",
  version: 1,
  description: "A one-line greeting that introduces someone by name.",
  outputType: "plaintext",
  schema: OneLineGreetingSchema,
  example: { greeting: "Hello", name: "Jen" },
  render,
});
```

The format can now render a validated document:

```ts
oneLineGreeting.jsonToString({ greeting: "Hi", name: "Ada" }); // "Hi, my name is Ada."
```

The format also now has a standalone script in `dist/standalone/one-line-greeting.js` that AI can use to create more instances of the content.

## Using the package instead of individual harness files

If your AI needs access to many different content harnesses in one skill or session, it may be simpler to call the package itself instead of calling each harness file.

The package includes an `ai-content-harness` CLI that works like the harness files, except that it takes the name of a format as its first argument. Install the package in your project:

```sh
npm install ai-content-harness
```

Then AI can run these commands with `npx`:

| Command                                               | What it does                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `npx ai-content-harness list`                         | Lists every available format, with its version and a short description.      |
| `npx ai-content-harness info <format>`                | Provides instructions for creating a JSON document in the given format.      |
| `npx ai-content-harness validate <format> input.json` | Validates the JSON document, with detailed feedback if the validation fails. |
| `npx ai-content-harness render <format> input.json`   | Validates, then templates the JSON document into the final content.          |

### Calling the package from code

You can also validate and render content in your own scripts. `getFormat()` looks up a format by name (and throws if no format has that name), and `formats` lists every registered format:

```ts
import { formats, getFormat } from "ai-content-harness";

const format = getFormat("president-description");

// The instructions, JSON Schema, and example that tell AI what to build
console.log(format.getInfo().instructions);

// Accepts a parsed object or a raw JSON string
const result = format.validateJson(aiOutput);
if (result.success) {
  console.log(format.jsonToString(result.data));
} else {
  // Feedback that AI can use to fix its JSON and try again
  console.error(result.feedback);
}
```

`jsonToString()` validates on its own too, and throws a `FormatValidationError` if the document is invalid.

## License

[MIT](./LICENSE)
