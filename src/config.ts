/**
 * Resolve the API key and base URL. Precedence: CLI flag → environment →
 * `~/.config/kursiva/config.json`. The default base URL is provisional until the
 * service is deployed; point it anywhere with `KURSIVA_API_URL` (or `--api-url`).
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { CliError, EXIT } from './errors.js'
import type { ParsedArgs } from './args.js'

export const DEFAULT_BASE_URL = 'https://api.kursiva.com/v1'

export interface CliConfig {
  apiKey?: string
  baseUrl: string
  timeoutMs: number
}

function configFilePath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(base, 'kursiva', 'config.json')
}

function readConfigFile(): { apiKey?: string; apiUrl?: string } {
  try {
    const parsed = JSON.parse(readFileSync(configFilePath(), 'utf-8'))
    return { apiKey: parsed.apiKey, apiUrl: parsed.apiUrl }
  } catch {
    return {}
  }
}

export function loadConfig(parsed: ParsedArgs): CliConfig {
  const file = readConfigFile()
  const apiKey = parsed.options['--api-key'] || process.env.KURSIVA_API_KEY || file.apiKey
  const baseUrl = (
    parsed.options['--api-url'] ||
    process.env.KURSIVA_API_URL ||
    file.apiUrl ||
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
      'No API key. Set KURSIVA_API_KEY, pass --api-key, or add it to ~/.config/kursiva/config.json.',
      { exitCode: EXIT.AUTH, code: 'no_api_key' }
    )
  }
  return config.apiKey
}
