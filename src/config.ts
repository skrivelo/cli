/**
 * Resolve the API key and base URL. Precedence: CLI flag → environment →
 * `~/.config/kursiva/config.json`. Point the client at another host with
 * `KURSIVA_API_URL` (or `--api-url`).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { CliError, EXIT } from './errors.js'
import type { ParsedArgs } from './args.js'

export const DEFAULT_BASE_URL = 'https://api.kursiva.com/v1'

export interface CliConfig {
  apiKey?: string
  baseUrl: string
  timeoutMs: number
}

export function configFilePath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(base, 'kursiva', 'config.json')
}

function readConfigFile(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(readFileSync(configFilePath(), 'utf-8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function storedApiKey(): string | undefined {
  const key = readConfigFile().apiKey
  return typeof key === 'string' && key ? key : undefined
}

/** Merge the key into the config file (0600 — it holds a credential). */
export function saveApiKey(apiKey: string): string {
  const path = configFilePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ ...readConfigFile(), apiKey }, null, 2)}\n`, {
    mode: 0o600
  })
  return path
}

export function loadConfig(parsed: ParsedArgs): CliConfig {
  const file = readConfigFile()
  const fileApiKey = typeof file.apiKey === 'string' ? file.apiKey : undefined
  const fileApiUrl = typeof file.apiUrl === 'string' ? file.apiUrl : undefined
  const apiKey = parsed.options['--api-key'] || process.env.KURSIVA_API_KEY || fileApiKey
  const baseUrl = (
    parsed.options['--api-url'] ||
    process.env.KURSIVA_API_URL ||
    fileApiUrl ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, '')

  const rawTimeout = parsed.options['--timeout']
  const timeoutSec = rawTimeout ? Number(rawTimeout) : 180
  if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) {
    throw new CliError(`Invalid --timeout "${rawTimeout}"; expected a positive number of seconds.`)
  }

  return { apiKey, baseUrl, timeoutMs: Math.round(timeoutSec * 1000) }
}

export function requireApiKey(config: CliConfig): string {
  if (!config.apiKey) {
    throw new CliError(
      'No API key. Get a free one: `kursiva signup you@example.com` emails a code, ' +
        'then `kursiva signup verify you@example.com <code>` issues and stores the key. ' +
        'Or set KURSIVA_API_KEY, pass --api-key, or add it to ~/.config/kursiva/config.json.',
      { exitCode: EXIT.AUTH, code: 'no_api_key' }
    )
  }
  return config.apiKey
}
