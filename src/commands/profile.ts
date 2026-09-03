/**
 * `skrivelo profile get|set|clear` — the stored brand profile (Lite+). `set`
 * reads a JSON file nested by profile group (see `skrivelo doctypes` for each
 * type's profile_group and field keys); the server applies it to every render.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CliError, EXIT } from '../errors.js'
import { printJson } from '../output.js'
import type { ApiClient } from '../client.js'
import type { ParsedArgs } from '../args.js'
import type { BrandProfile } from '../types.js'

const USAGE = `Usage:
  skrivelo profile get                 show the stored brand profile
  skrivelo profile set <profile.json>  replace it (applied to every render)
  skrivelo profile clear               delete it — renders return to the neutral identity`

export function readProfileFile(path: string): BrandProfile {
  let text: string
  try {
    text = readFileSync(resolve(path), 'utf-8')
  } catch (err) {
    throw new CliError(`Cannot read "${path}": ${(err as NodeJS.ErrnoException).message}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new CliError(`"${path}" is not valid JSON.`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CliError(
      `"${path}" must be a JSON object nested by profile group, e.g. {"business": {"company_name": "…"}}.`
    )
  }
  return parsed as BrandProfile
}

export async function profileCommand(
  parsed: ParsedArgs,
  client: ApiClient,
  json: boolean
): Promise<number> {
  const sub = parsed.positionals[1]

  if (sub === 'get') {
    const res = await client.getProfile()
    printJson(res.profile)
    return EXIT.OK
  }

  if (sub === 'set') {
    const file = parsed.positionals[2]
    if (!file) throw new CliError(USAGE)
    const res = await client.putProfile(readProfileFile(file))
    if (json) printJson(res)
    else console.log(`Stored profile set (${Object.keys(res.profile).length} group(s)).`)
    return EXIT.OK
  }

  if (sub === 'clear') {
    const res = await client.deleteProfile()
    if (json) printJson(res)
    else console.log(res.deleted ? 'Stored profile cleared.' : 'No stored profile to clear.')
    return EXIT.OK
  }

  console.error(USAGE)
  return EXIT.USAGE
}
