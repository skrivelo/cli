# [<]kursiva

**Turn Markdown into a print-grade, professionally designed PDF — from any shell.**

`kursiva` is a small command-line client for the [<]kursiva render API. Point it at a Markdown file, pick a template from a hosted catalog of professionally designed documents, and get a finished PDF on disk. No design skills, no HTML, no headless browser — the rendering happens server-side.

```
markdown in  →  kursiva render  →  polished PDF out
```

It is built for agents and scripts: every command speaks `--json`, exit codes are distinct and stable, and the whole surface is documented for skill-reading agents in [`SKILL.md`](./SKILL.md).

## Install

```
npm install -g kursiva
# or, ad-hoc:
npx kursiva --help
```

Requires Node.js 20+.

## Getting a key

Self-signup is built in — free tier, no card, no account form:

```
kursiva signup you@example.com          # emails you a one-time code
kursiva signup verify you@example.com <code>
```

`verify` prints the key (the API shows it exactly once) and stores it in `~/.config/kursiva/config.json`, so every later command just works. One key per email — and losing it is fine: run the same two commands again and verifying issues a fresh key, revoking the old one.

## Authentication

Commands read the key from (in precedence order) the `--api-key` flag → `KURSIVA_API_KEY` → `~/.config/kursiva/config.json` (`{ "apiKey": "krsv_..." }`). Point the client at a specific host with `KURSIVA_API_URL` or `--api-url`.

## Quickstart

```
# 1. discover a template
kursiva templates search "quotation" --type quotation

# 2. read what it accepts
kursiva templates describe <template-id>

# 3. render your Markdown into a PDF
kursiva render quote.md --template <template-id> \
  --field client="ACME Corp" --theme accent=#0a5 -o quote.pdf
```

`describe` is the keystone: it returns the template's content fields (which map to `--field key=value`) and its theme tokens (which map to `--theme name=value`), plus a sample payload.

## Commands

| Command | Description |
| --- | --- |
| `kursiva signup <email>` | Request a free API key — emails a one-time code. |
| `kursiva signup verify <email> <code>` | Redeem the code; prints and stores the key. |
| `kursiva doctypes` | List document types and their template counts. |
| `kursiva templates search [query] --type <doc_type> --locale <l>` | Search the template catalog. |
| `kursiva templates describe <id>` | The template's input contract (fields, theme tokens, locales, page format, sample). |
| `kursiva render <file.md> --template <id> [flags]` | Render Markdown + fields to a PDF. |
| `kursiva profile get \| set <file.json> \| clear` | Stored brand identity, applied to every render (Lite+). |
| `kursiva assets list \| upload <image> \| rm <id>` | Durable images (e.g. your logo), referenced as `img_…` ids (Lite+). |

Global flags: `--json` (machine-readable output), `--version`, `-h`/`--help`.

### `render` flags

| Flag | Meaning |
| --- | --- |
| `--template <id>` | Template to render with (required). |
| `--field key=value` | A content field value (repeatable). |
| `--theme name=value` | Recolor/restyle a theme token (repeatable). |
| `--locale <code>` | Document language, from the template's locales. |
| `-o <path>` | Output path (default: the input file with a `.pdf` extension). |
| `--profile <file.json>` | Per-render brand identity; wins per key over the stored profile (Lite+). |
| `--timeout <seconds>` | How long to wait for a render (default 180). |

## Brand identity (Lite+)

Store your identity once and every render carries it; free-tier renders use each template's neutral brand bundle.

```bash
kursiva assets upload logo.png     # → img_… asset id
kursiva profile set profile.json   # applied to every subsequent render
```

`profile.json` is nested by *profile group* — `kursiva doctypes --json` lists each document type's `profile_group` and its `profile_fields` (keys + types):

```json
{ "business": { "company_name": "ACME GmbH", "company_logo": "img_…", "iban": "DE02…" } }
```

Image-type fields take an uploaded `img_…` asset ref. For one-off branding (e.g. per client), pass `--profile client.json` on `render` — it overrides the stored profile per key for that render only.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Usage error / unreadable file / network failure |
| `2` | Authentication (missing or invalid key) |
| `3` | Quota or rate limit reached |
| `4` | Bad request (invalid theme token, unsupported locale, page cap exceeded) |
| `5` | Template not found |
| `6` | Request too large |
| `7` | Server error |
| `8` | Tier too low (template outside the free-tier catalog) |

## For agents

[`SKILL.md`](./SKILL.md) teaches any skill-reading agent the full search → describe → render loop with zero prior knowledge. Drop it into an agent's skill directory alongside an API key.

## Development

```
npm install
npm run typecheck
npm test
npm run build      # emits dist/
```

## License

MIT — see [`LICENSE`](./LICENSE).
