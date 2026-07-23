/**
 * CLI dispatch. Parses argv once (all flags share one global spec), resolves the
 * key + base URL, builds the client, and routes to a command. Every failure is
 * funnelled through `handleError`, which honours `--json` and returns the mapped
 * exit code. Returns the intended process exit code — `index.ts` sets it.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from './args.js'
import { ApiClient } from './client.js'
import { loadConfig, requireApiKey } from './config.js'
import { ApiError, CliError, EXIT } from './errors.js'
import { printJson } from './output.js'
import { doctypesCommand } from './commands/doctypes.js'
import { renderCommand } from './commands/render.js'
import { signupCommand } from './commands/signup.js'
import { templatesDescribeCommand } from './commands/templatesDescribe.js'
import { templatesSearchCommand } from './commands/templatesSearch.js'
import type { ApiErrorBody } from './types.js'

export async function main(argv: string[]): Promise<number> {
  let json = false
  try {
    const parsed = parseArgs(argv)
    json = parsed.flags.has('--json')

    if (parsed.flags.has('--version')) {
      console.log(readVersion())
      return EXIT.OK
    }

    const command = parsed.positionals[0]
    if (parsed.flags.has('--help')) {
      console.log(usage(command))
      return EXIT.OK
    }
    if (!command) {
      console.error(usage())
      return EXIT.USAGE
    }

    const config = loadConfig(parsed)
    // Signup is the one keyless command — it's how the key is obtained. Its
    // routes are public; send no bearer even if a key happens to be configured.
    const signup = command === 'signup'
    if (!signup) config.apiKey = requireApiKey(config)
    const client = new ApiClient({
      baseUrl: config.baseUrl,
      apiKey: signup ? undefined : config.apiKey,
      timeoutMs: config.timeoutMs
    })

    switch (command) {
      case 'signup':
        return await signupCommand(parsed, client, json)
      case 'doctypes':
        return await doctypesCommand(client, json)
      case 'templates': {
        const sub = parsed.positionals[1]
        if (sub === 'search') return await templatesSearchCommand(parsed, client, json)
        if (sub === 'describe') return await templatesDescribeCommand(parsed, client, json)
        console.error(usage('templates'))
        return EXIT.USAGE
      }
      case 'render':
        return await renderCommand(parsed, client, json)
      default:
        console.error(`Unknown command: ${command}\n\n${usage()}`)
        return EXIT.USAGE
    }
  } catch (err) {
    return handleError(err, json)
  }
}

function handleError(err: unknown, json: boolean): number {
  if (err instanceof ApiError) {
    if (json) printJson(err.body)
    else console.error(formatApiError(err.body))
    return err.exitCode
  }
  if (err instanceof CliError) {
    if (json) printJson({ error: { code: err.code, message: err.message } })
    else console.error(`Error: ${err.message}`)
    return err.exitCode
  }
  const message = err instanceof Error ? err.message : String(err)
  if (json) printJson({ error: { code: 'unexpected', message } })
  else console.error(`Error: ${message}`)
  return EXIT.USAGE
}

function formatApiError(body: ApiErrorBody): string {
  const lines = [`Error [${body.error.code}]: ${body.error.message}`]
  if (body.error.hint) lines.push(`  hint: ${body.error.hint}`)
  if (body.pages_produced !== undefined) {
    lines.push(`  produced ${body.pages_produced} pages (cap ${body.cap}).`)
  }
  if (body.quota !== undefined) {
    lines.push(`  quota: ${body.used}/${body.quota} used this ${body.period}.`)
  }
  if (body.retry_after !== undefined) lines.push(`  retry after ${body.retry_after}s.`)
  return lines.join('\n')
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8')
    )
    return `kursiva ${pkg.version}`
  } catch {
    return 'kursiva (unknown version)'
  }
}

function usage(command?: string): string {
  if (command === 'signup') {
    return `Usage:
  kursiva signup <email>                  request a free key — emails a one-time code
  kursiva signup verify <email> <code>    redeem the code; the key is issued once and stored`
  }
  if (command === 'templates') {
    return `Usage:
  kursiva templates search [query] [--type <doc_type>] [--locale <l>] [--json]
  kursiva templates describe <id> [--json]`
  }
  if (command === 'render') {
    return `Usage:
  kursiva render <file.md> --template <id> [--field k=v ...] [--theme k=v ...] [--locale <l>] [-o out.pdf] [--timeout <s>] [--json]`
  }
  return `kursiva — command-line client for the Kursiva render API

Usage:
  kursiva signup <email>                  get a free API key (emails a one-time code)
  kursiva signup verify <email> <code>
  kursiva doctypes [--json]
  kursiva templates search [query] [--type <doc_type>] [--locale <l>] [--json]
  kursiva templates describe <id> [--json]
  kursiva render <file.md> --template <id> [--field k=v ...] [--theme k=v ...] [-o out.pdf] [--json]

Auth:
  Set KURSIVA_API_KEY (or --api-key), and optionally KURSIVA_API_URL (or --api-url).
  No key yet? \`kursiva signup <email>\` issues a free-tier key — no card, no account form.

Global flags:
  --json       machine-readable output on every command
  --version    print the CLI version
  -h, --help   show this help

Exit codes:
  0 success · 1 usage/file/network · 2 auth (401) · 3 quota (429) ·
  4 bad request/page cap (400) · 5 not found (404) · 6 too large (413) · 7 server (5xx) ·
  8 tier too low (403)`
}
