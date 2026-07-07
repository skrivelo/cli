/**
 * Download a rendered document to disk. Production hands back an `https://`
 * signed URL; a locally-run API hands back a `file://` path — the CLI resolves
 * both so the same code path works against a local instance and the deployed API.
 *
 * `document_url` is server-controlled, so it is validated against the configured
 * base URL before anything is read or fetched: only `https://` (signed URLs are
 * cross-host by design), `file://`/loopback-`http://` when we are actually
 * talking to a local API, or a same-host plain-`http://` URL are honoured. This
 * stops a malicious or compromised API from turning the download into a
 * local-file read or an SSRF probe. The remote fetch carries its own timeout and
 * refuses redirects (an approved https URL cannot bounce to an internal host).
 */

import { writeFile, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { CliError, EXIT } from './errors.js'

export interface DownloadOptions {
  baseUrl: string
  timeoutMs: number
}

export async function downloadTo(
  url: string,
  outPath: string,
  opts: DownloadOptions
): Promise<void> {
  if (typeof url !== 'string' || url.length === 0) {
    throw new CliError('The server did not return a document URL.', {
      code: 'bad_response',
      exitCode: EXIT.SERVER
    })
  }

  let target: URL
  try {
    target = new URL(url)
  } catch {
    throw new CliError(`The server returned an invalid document URL: "${url}".`, {
      code: 'bad_response',
      exitCode: EXIT.SERVER
    })
  }

  assertDownloadAllowed(target, opts.baseUrl)

  if (target.protocol === 'file:') {
    await copyFile(fileURLToPath(target), outPath)
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
  try {
    const res = await fetch(target, { signal: controller.signal, redirect: 'error' })
    if (!res.ok) {
      throw new CliError(`Failed to download document: HTTP ${res.status}`)
    }
    await writeFile(outPath, Buffer.from(await res.arrayBuffer()))
  } catch (err) {
    if (err instanceof CliError) throw err
    if ((err as Error).name === 'AbortError') {
      throw new CliError(
        `Document download timed out after ${Math.round(opts.timeoutMs / 1000)}s.`,
        {
          code: 'timeout'
        }
      )
    }
    throw new CliError(`Failed to download document: ${(err as Error).message}`)
  } finally {
    clearTimeout(timer)
  }
}

const LOOPBACK_HOSTS = new Set(['localhost', '::1', '0.0.0.0'])

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '')
  return LOOPBACK_HOSTS.has(host) || host.startsWith('127.')
}

/**
 * Reject any server-returned URL that could read a local file or reach an
 * internal host. Allowed: https:// (cross-host signed URLs); file:// and
 * loopback http:// only when the base URL is itself local; same-host plain
 * http:// (the trusted self-hosted API). Everything else throws.
 */
function assertDownloadAllowed(target: URL, baseUrl: string): void {
  let base: URL | undefined
  try {
    base = new URL(baseUrl)
  } catch {
    base = undefined
  }
  const baseIsLocal = base ? isLoopbackHost(base.hostname) : false

  if (target.protocol === 'https:') return
  if (target.protocol === 'file:' && baseIsLocal) return
  if (target.protocol === 'http:' && baseIsLocal && isLoopbackHost(target.hostname)) return
  if (
    target.protocol === 'http:' &&
    base !== undefined &&
    base.protocol === 'http:' &&
    target.host === base.host
  ) {
    return
  }

  throw new CliError(
    `Refusing to download from "${redactUrl(target)}": ` +
      `only https:// URLs (or local files from a local API) are allowed.`,
    { code: 'blocked_url', exitCode: EXIT.SERVER }
  )
}

/** Drop the query so a signed-URL credential never lands in an error message. */
function redactUrl(target: URL): string {
  if (target.protocol === 'file:') return `file://${target.pathname}`
  return `${target.protocol}//${target.host}${target.pathname}`
}
