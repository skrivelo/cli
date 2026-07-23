/**
 * Self-signup: `signup <email>` mails a one-time code, `signup verify <email>
 * <code>` mints the Free key. The key is shown exactly once by the API, so
 * verify persists it to the config file immediately — unless a different key is
 * already stored, which is never overwritten (it may be unrecoverable).
 */

import { saveApiKey, storedApiKey } from '../config.js'
import { CliError, EXIT } from '../errors.js'
import { printJson } from '../output.js'
import type { ApiClient } from '../client.js'
import type { ParsedArgs } from '../args.js'

export async function signupCommand(
  parsed: ParsedArgs,
  client: ApiClient,
  json: boolean
): Promise<number> {
  const [, first, ...rest] = parsed.positionals
  if (first === 'verify') return verify(rest, client, json)
  if (!first || rest.length > 0) {
    throw new CliError('Usage: kursiva signup <email> | kursiva signup verify <email> <code>')
  }

  const accepted = await client.signup(first)
  if (json) {
    printJson(accepted)
  } else {
    console.log(`If eligible, a verification code was emailed to ${first}.`)
    console.log(`Next: kursiva signup verify ${first} <code>`)
  }
  return EXIT.OK
}

async function verify(rest: string[], client: ApiClient, json: boolean): Promise<number> {
  const [email, code, ...extra] = rest
  if (!email || !code || extra.length > 0) {
    throw new CliError('Usage: kursiva signup verify <email> <code>')
  }

  const minted = await client.verifySignup(email, code)
  const existing = storedApiKey()
  const saved = !existing || existing === minted.api_key ? saveApiKey(minted.api_key) : undefined
  const note = saved
    ? `Stored in ${saved}`
    : 'NOT stored: the config file already holds a different key. Save it yourself.'

  if (json) {
    printJson(minted)
    console.error(note)
  } else {
    console.log(`API key (shown once): ${minted.api_key}`)
    console.log(`Tier: ${minted.tier} · monthly quota: ${minted.monthly_quota} renders`)
    console.log(note)
  }
  return EXIT.OK
}
