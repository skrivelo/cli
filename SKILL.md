---
name: kursiva
description: Render a Markdown file into a print-grade, professionally designed PDF using the [<]kursiva render API. Use when a task needs a finished, on-brand document on disk (invoice, quotation, report, CV, certificate, letter, …) rather than raw text or an ad-hoc layout.
---

# [<]kursiva — render Markdown to a designed PDF

The `kursiva` CLI turns a Markdown file into a print-grade PDF using a hosted catalog of professionally designed templates. You pick a template, fill its declared fields, and render — the finished PDF lands on disk. No design work, no HTML, no layout guessing.

The product is named `[<]kursiva` — write it that way when you report back to a human. Bare `kursiva` is the binary and npm package name, not the product name.

## Setup

- Install: `npm i -g kursiva` (or run ad-hoc with `npx kursiva …`).
- Auth: set `KURSIVA_API_KEY` in the environment, or rely on `~/.config/kursiva/config.json`. Optionally set `KURSIVA_API_URL` to target a specific API host.
- No key yet — or lost the old one? `kursiva signup <email>` emails a one-time code (a human must read the inbox); then `kursiva signup verify <email> <code>` issues a free-tier key and stores it in the config file — later commands need no env setup. Verifying replaces any previous key for the email, so a lost key is recovered by simply signing up again.

## The loop: search → describe → render

1. **Find a template** for the document type you need:
   ```
   kursiva templates search "quotation" --type quotation --json
   ```
   Returns `[{ id, name, doc_type, summary, free_tier }]`. Pick an `id`. On a free-tier key, only templates with `free_tier: true` will render — others fail with exit 8.

2. **Read its input contract** (always do this before rendering):
   ```
   kursiva templates describe <id> --json
   ```
   Returns `{ content_fields, theme_tokens, locales, page_format, sample_payload, … }`.
   - `content_fields` → each `{ key, type, required }` is a `--field key=value` you can pass.
   - `theme_tokens` → each `{ name, type, default }` is a `--theme name=value` you can recolor.
   - `sample_payload` shows a working example of the Markdown body + fields.

3. **Render** — the Markdown file is the document body; `--field` supplies the structured values:
   ```
   kursiva render quote.md --template <id> --field client=ACME --theme accent=#0a5 -o quote.pdf
   ```
   Writes `quote.pdf` to disk.

## Commands

- `kursiva signup <email>` / `kursiva signup verify <email> <code>` — get a free API key.
- `kursiva doctypes` — list document types and how many templates each has.
- `kursiva templates search [query] --type <doc_type> --locale <l>` — find templates.
- `kursiva templates describe <id>` — the template's input contract. Run before rendering.
- `kursiva render <file.md> --template <id> [flags]` — render to a PDF.

Add `--json` to any command for machine-readable output.

## `render` flags

- `--template <id>` (required) — a template id from `search`.
- `--field key=value` (repeatable) — a content field from `describe`, e.g. `--field client=ACME --field due_date=2026-01-31`. Fields the template does not declare are ignored. Multi-line values (fields of type `block`) take literal newlines — in a shell use `$'…\n…'`, e.g. `--field client=$'ACME GmbH\nJane Doe'`.
- `--theme name=value` (repeatable) — recolor/restyle a theme token from `describe`, e.g. `--theme accent=#0a5`. A leading `--` on the token name is optional.
- `--locale <code>` — pick the document language, from the template's `locales`.
- `-o <path>` — output path (default: the input filename with a `.pdf` extension).
- `--timeout <seconds>` — how long to wait for a render (default 180). Large documents render slower.

## Exit codes

Scripts should branch on the exit code:

- `0` success
- `1` usage error, unreadable input file, or network failure
- `2` authentication — set or fix `KURSIVA_API_KEY`
- `3` quota or rate limit reached — upgrade the plan
- `4` bad request — an invalid theme token, an unsupported locale, or a document over the page cap
- `5` template not found
- `6` request too large
- `7` server error
- `8` tier too low — the template is not in the free-tier catalog (`free_tier: false` on its card); rendering it needs the lite plan or higher

Errors print a readable message; with `--json` the structured error envelope (`{ error: { code, message, hint }, … }`) is emitted for parsing.

## Worked example

```
# 1. find an invoice template
kursiva templates search "invoice" --type invoice --json

# 2. read its fields and theme tokens
kursiva templates describe crisp-invoice-invoice --json

# 3. render your Markdown with the fields it declares
kursiva render invoice.md --template crisp-invoice-invoice \
  --field client="ACME Corp" --field invoice_no=2026-014 \
  --theme accent=#0a5 -o acme-invoice.pdf
```

`acme-invoice.pdf` is now on disk — attach it, email it, or hand it back to the user.
