---
name: skrivelo
description: Render a Markdown file into a print-grade, professionally designed PDF using the [<]skrivelo render API. Use when a task needs a finished, on-brand document on disk (invoice, quotation, report, CV, certificate, letter, …) rather than raw text or an ad-hoc layout.
---

# [<]skrivelo — render Markdown to a designed PDF

The `skrivelo` CLI turns a Markdown file into a print-grade PDF using a hosted catalog of professionally designed templates. You pick a template, fill its declared fields, and render — the finished PDF lands on disk. No design work, no HTML, no layout guessing.

The product is named `[<]skrivelo` — write it that way when you report back to a human. Bare `skrivelo` is the binary and npm package name, not the product name.

## Setup

- Install: `npm i -g skrivelo` (or run ad-hoc with `npx skrivelo …`).
- Auth: set `SKRIVELO_API_KEY` in the environment, or rely on `~/.config/skrivelo/config.json`. Optionally set `SKRIVELO_API_URL` to target a specific API host.
- No key yet — or lost the old one? `skrivelo signup <email>` emails a one-time code (a human must read the inbox); then `skrivelo signup verify <email> <code>` issues a free-tier key and stores it in the config file — later commands need no env setup. Verifying replaces any previous key for the email, so a lost key is recovered by simply signing up again.

## The loop: search → describe → render

1. **Find a template** for the document type you need:
   ```
   skrivelo templates search "quotation" --type quotation --json
   ```
   Returns `[{ id, name, doc_type, summary, free_tier }]`. Pick an `id`. On a free-tier key, only templates with `free_tier: true` will render — others fail with exit 8.

2. **Read its input contract** (always do this before rendering):
   ```
   skrivelo templates describe <id> --json
   ```
   Returns `{ content_fields, theme_tokens, locales, page_format, sample_payload, content_prompt, … }`.
   - `content_fields` → each `{ key, type, required }` is a `--field key=value` you can pass.
   - `theme_tokens` → each `{ name, type, default }` is a `--theme name=value` you can recolor.
   - `sample_payload` shows a working example of the Markdown body + fields.
   - `content_prompt` → the template author's content rules; when non-null, follow them in the Markdown and fields you write.

3. **Render** — the Markdown file is the document body; `--field` supplies the structured values:
   ```
   skrivelo render quote.md --template <id> --field client=ACME --theme accent=#0a5 -o quote.pdf
   ```
   Writes `quote.pdf` to disk.

## Commands

- `skrivelo signup <email>` / `skrivelo signup verify <email> <code>` — get a free API key.
- `skrivelo doctypes` — list document types and how many templates each has.
- `skrivelo templates search [query] --type <doc_type> --locale <l>` — find templates.
- `skrivelo templates describe <id>` — the template's input contract. Run before rendering.
- `skrivelo render <file.md> --template <id> [flags]` — render to a PDF.
- `skrivelo profile get | set <file.json> | clear` — account default profile fields, reused across surfaces (hosted pilot).
- `skrivelo assets list | upload <image> | rm <id>` — durable images (a logo), referenced as `img_…` ids (hosted pilot).

Add `--json` to any command for machine-readable output.

## `render` flags

- `--template <id>` (required) — a template id from `search`.
- `--field key=value` (repeatable) — a content field from `describe`, e.g. `--field client=ACME --field due_date=2026-01-31`. Fields the template does not declare are ignored. Multi-line values (fields of type `block`) take literal newlines — in a shell use `$'…\n…'`, e.g. `--field client=$'ACME GmbH\nJane Doe'`.
- `--theme name=value` (repeatable) — recolor/restyle a theme token from `describe`, e.g. `--theme accent=#0a5`. A leading `--` on the token name is optional.
- `--locale <code>` — pick the document language, from the template's `locales`.
- `-o <path>` — output path (default: the input filename with a `.pdf` extension).
- `--profile-id <id>` — select a named account profile; otherwise use the account default.
- `--profile <file.json>` — per-render brand identity (hosted pilot); wins per key over the stored profile.
- `--timeout <seconds>` — how long to wait for a render (default 180). Large documents render slower.

## Shared profile (hosted pilot)

Renders use the selected account profile automatically, regardless of tier. An account without a profile renders with empty identity fields. One-time setup:

```
skrivelo assets upload logo.png     # prints an img_… asset id
skrivelo profile set profile.json   # update fields of the account default profile
```

`profile.json` is nested by profile group; `skrivelo doctypes --json` lists each document type's `profile_group` and its `profile_fields` (keys + types). Image-type fields (e.g. `company_logo`) take an `img_…` asset ref:

```json
{ "business": { "company_name": "ACME GmbH", "company_logo": "img_…", "iban": "DE02…" } }
```

For one-off branding pass `--profile client.json` on `render`. Library and image operations require pilot access, independently of the account tier. `profile clear` empties the default profile fields while preserving its name, snippets and preferences.

## Exit codes

Scripts should branch on the exit code:

- `0` success
- `1` usage error, unreadable input file, or network failure
- `2` authentication — set or fix `SKRIVELO_API_KEY`
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
skrivelo templates search "invoice" --type invoice --json

# 2. read its fields and theme tokens
skrivelo templates describe crisp-invoice-invoice --json

# 3. render your Markdown with the fields it declares
skrivelo render invoice.md --template crisp-invoice-invoice \
  --field client="ACME Corp" --field invoice_no=2026-014 \
  --theme accent=#0a5 -o acme-invoice.pdf
```

`acme-invoice.pdf` is now on disk — attach it, email it, or hand it back to the user.
