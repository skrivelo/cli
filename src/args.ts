/**
 * Hand-rolled argv parser (no dependency), mirroring the house CLI style:
 * supports `--flag value` and `--flag=value`, throws on unknown flags / missing
 * values. `--field` and `--theme` are repeatable and consume their value
 * literally — a theme token copied from `describe` carries a leading `--`
 * (a CSS custom property), so those values must not be re-rejected for starting
 * with a dash. Everything else is a positional (command / subcommand / file).
 */

import { CliError } from './errors.js'

export interface ParsedArgs {
  positionals: string[]
  options: Record<string, string>
  flags: Set<string>
  repeated: Record<string, string[]>
}

const ALIASES: Record<string, string> = { '-o': '--output', '-h': '--help' }
const STRING_OPTS = new Set([
  '--template',
  '--type',
  '--locale',
  '--output',
  '--profile',
  '--timeout',
  '--api-url',
  '--api-key'
])
const REPEATED_OPTS = new Set(['--field', '--theme'])
const BOOL_FLAGS = new Set(['--json', '--help', '--version'])

function canon(flag: string): string {
  return ALIASES[flag] ?? flag
}

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    positionals: [],
    options: {},
    flags: new Set(),
    repeated: { '--field': [], '--theme': [] }
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    // Inline form: --flag=value (split on the FIRST '=' so `--theme=a=b` keeps `a=b`).
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1
    if (eq > 0) {
      const flag = canon(arg.slice(0, eq))
      const val = arg.slice(eq + 1)
      if (STRING_OPTS.has(flag)) {
        out.options[flag] = val
        continue
      }
      if (REPEATED_OPTS.has(flag)) {
        out.repeated[flag].push(val)
        continue
      }
      if (BOOL_FLAGS.has(flag)) throw new CliError(`Flag ${flag} does not take a value.`)
      throw new CliError(`Unknown option: ${arg.slice(0, eq)}`)
    }

    const flag = canon(arg)
    if (BOOL_FLAGS.has(flag)) {
      out.flags.add(flag)
      continue
    }
    if (REPEATED_OPTS.has(flag)) {
      const next = argv[i + 1]
      if (next === undefined) throw new CliError(`Missing value for ${flag}.`)
      out.repeated[flag].push(next) // literal — may start with '-'
      i++
      continue
    }
    if (STRING_OPTS.has(flag)) {
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('-')) {
        throw new CliError(`Missing value for ${flag}.`)
      }
      out.options[flag] = next
      i++
      continue
    }
    if (arg.startsWith('-')) throw new CliError(`Unknown option: ${arg}`)
    out.positionals.push(arg)
  }

  return out
}

/**
 * Split `key=value` items into an object. `stripLeadingDashes` drops one leading
 * `--` from the key (theme tokens copied from `describe` carry it; the API
 * accepts both `--token` and bare `token`).
 */
export function parseKvPairs(
  list: string[],
  opts?: { stripLeadingDashes?: boolean }
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const item of list) {
    const eq = item.indexOf('=')
    if (eq <= 0) throw new CliError(`Expected key=value, got "${item}".`)
    let key = item.slice(0, eq)
    const value = item.slice(eq + 1)
    if (opts?.stripLeadingDashes) key = key.replace(/^--/, '')
    result[key] = value
  }
  return result
}
