/**
 * Self-signup: `signup <email>` mails a one-time code, `signup verify <email>
 * <code>` mints the key. Verifying rotates: any previous key for the email is
 * revoked server-side and replaced, so re-running signup recovers a lost key.
 * The key is shown exactly once by the API, so verify persists it to the config
 * file immediately — a different stored key is replaced only when the API no
 * longer accepts it (a still-working one may belong to another email and could
 * be unrecoverable).
 */

import { saveApiKey, storedApiKey } from '../config.js'
import { ApiClient } from '../client.js'
import { ApiError, CliError, EXIT } from '../errors.js'
import { printJson } from '../output.js'
import type { ParsedArgs } from '../args.js'

export async function signupCommand(
  parsed: ParsedArgs,
  client: ApiClient,
  json: boolean
): Promise<number> {
  const [, first, ...rest] = parsed.positionals
  if (first === 'verify') return verify(rest, client, json)
  if (!first || rest.length > 0) {
    throw new CliError('Usage: skrivelo signup <email> | skrivelo signup verify <email> <code>')
  }

  const version = parsed.options['--accept-terms-version']
  const adult = parsed.flags.has('--adult')
  const language = parsed.options['--locale'] === 'de' ? 'de' : 'en'
  const termsUrl = `https://app.skrivelo.com/web/legal/api-terms?lang=${language}`
  if (version && !adult)
    throw new CliError(
      `Confirm you are 18 or older with --adult. Review the API terms at ${termsUrl} before accepting their exact version.`
    )
  if (!version && !json)
    console.log(
      `Existing-key recovery only. New accounts require --accept-terms-version <published-version> --adult after reviewing ${termsUrl}. Draft terms cannot be accepted.`
    )
  const accepted = await client.signup(
    first,
    version
      ? {
          termsAccepted: true,
          adultConfirmed: adult,
          version,
          language,
          product: 'api'
        }
      : undefined
  )
  if (json) {
    printJson(accepted)
  } else {
    console.log(`If eligible, a verification code was emailed to ${first}.`)
    console.log(`Next: skrivelo signup verify ${first} <code>`)
  }
  return EXIT.OK
}

async function verify(rest: string[], client: ApiClient, json: boolean): Promise<number> {
  const [email, code, ...extra] = rest
  if (!email || !code || extra.length > 0) {
    throw new CliError('Usage: skrivelo signup verify <email> <code>')
  }

  const minted = await client.verifySignup(email, code)
  const note = await storeKey(minted.api_key, client)
  const rotatedNote = minted.rotated
    ? 'A previous key for this email was revoked and replaced.'
    : undefined

  if (json) {
    printJson(minted)
    if (rotatedNote) console.error(rotatedNote)
    console.error(note)
  } else {
    console.log(`API key (shown once): ${minted.api_key}`)
    console.log(`Tier: ${minted.tier} · monthly quota: ${minted.monthly_quota} renders`)
    if (rotatedNote) console.log(rotatedNote)
    console.log(note)
  }
  return EXIT.OK
}

async function storeKey(freshKey: string, client: ApiClient): Promise<string> {
  const existing = storedApiKey()
  if (!existing || existing === freshKey) return `Stored in ${saveApiKey(freshKey)}`
  if (await keyIsDead(existing, client)) {
    return `Stored in ${saveApiKey(freshKey)} (replaced a stored key the API no longer accepts)`
  }
  return 'NOT stored: the config file holds a different, still-working key. Save it yourself.'
}

/** Only a definitive 401 counts — a network hiccup must not clobber a live key. */
async function keyIsDead(key: string, client: ApiClient): Promise<boolean> {
  const probe = new ApiClient({
    baseUrl: client.baseUrl,
    apiKey: key,
    timeoutMs: client.timeoutMs
  })
  try {
    await probe.doctypes()
    return false
  } catch (err) {
    return err instanceof ApiError && err.status === 401
  }
}
