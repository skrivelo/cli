import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { downloadTo } from '../src/download.js'
import { CliError } from '../src/errors.js'

type FetchLike = (url: unknown, init: RequestInit) => Promise<unknown>

const LOCAL = 'http://127.0.0.1:8787/v1'
const REMOTE = 'https://api.kursiva.com/v1'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kursiva-dl-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.unstubAllGlobals()
})

function bytesResponse(bytes: string) {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => new TextEncoder().encode(bytes).buffer
  }
}

describe('downloadTo — URL policy', () => {
  it('copies a file:// URL when the base URL is a local API', async () => {
    const src = join(dir, 'src.pdf')
    writeFileSync(src, '%PDF-1.4 local')
    const out = join(dir, 'out.pdf')
    await downloadTo(pathToFileURL(src).href, out, { baseUrl: LOCAL, timeoutMs: 5000 })
    expect(readFileSync(out, 'utf-8')).toContain('%PDF-1.4 local')
  })

  it('refuses a file:// URL when the base URL is remote (blocks arbitrary local-file read)', async () => {
    const secret = join(dir, 'secret.txt')
    writeFileSync(secret, 'BEGIN PRIVATE KEY')
    const out = join(dir, 'out.pdf')
    await expect(
      downloadTo(pathToFileURL(secret).href, out, { baseUrl: REMOTE, timeoutMs: 5000 })
    ).rejects.toMatchObject({ code: 'blocked_url' })
    expect(existsSync(out)).toBe(false)
  })

  it('refuses http:// to a link-local metadata host (SSRF)', async () => {
    await expect(
      downloadTo('http://169.254.169.254/latest/meta-data/', join(dir, 'o.pdf'), {
        baseUrl: REMOTE,
        timeoutMs: 5000
      })
    ).rejects.toMatchObject({ code: 'blocked_url' })
  })

  it('refuses http://localhost when the base URL is remote', async () => {
    await expect(
      downloadTo('http://localhost:9999/x', join(dir, 'o.pdf'), {
        baseUrl: REMOTE,
        timeoutMs: 5000
      })
    ).rejects.toMatchObject({ code: 'blocked_url' })
  })

  it('allows http://localhost when the base URL is a local API', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => bytesResponse('%PDF local-http'))
    vi.stubGlobal('fetch', fetchMock)
    const out = join(dir, 'o.pdf')
    await downloadTo('http://localhost:8787/doc.pdf', out, { baseUrl: LOCAL, timeoutMs: 5000 })
    expect(readFileSync(out, 'utf-8')).toContain('%PDF local-http')
  })

  it('allows a cross-host https:// signed URL and disables redirects', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => bytesResponse('%PDF signed'))
    vi.stubGlobal('fetch', fetchMock)
    const out = join(dir, 'o.pdf')
    await downloadTo('https://storage.example/doc.pdf?sig=abc', out, {
      baseUrl: REMOTE,
      timeoutMs: 5000
    })
    expect(readFileSync(out, 'utf-8')).toContain('%PDF signed')
    expect((fetchMock.mock.calls[0][1] as RequestInit).redirect).toBe('error')
  })

  it('rejects an empty document URL as a bad response', async () => {
    await expect(
      downloadTo('', join(dir, 'o.pdf'), { baseUrl: REMOTE, timeoutMs: 5000 })
    ).rejects.toMatchObject({ code: 'bad_response' })
  })

  it('rejects an unparsable document URL as a bad response', async () => {
    await expect(
      downloadTo('not a url', join(dir, 'o.pdf'), { baseUrl: REMOTE, timeoutMs: 5000 })
    ).rejects.toMatchObject({ code: 'bad_response' })
  })

  it('does not leak a signed-URL query in a block message', async () => {
    try {
      await downloadTo('http://evil.example/x?sig=SECRET', join(dir, 'o.pdf'), {
        baseUrl: REMOTE,
        timeoutMs: 5000
      })
      throw new Error('expected a throw')
    } catch (err) {
      expect(err).toBeInstanceOf(CliError)
      expect((err as CliError).message).not.toContain('SECRET')
    }
  })

  it('maps a download abort to a timeout CliError', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const fetchMock = vi.fn<FetchLike>(async () => {
      throw abort
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      downloadTo('https://storage.example/doc.pdf', join(dir, 'o.pdf'), {
        baseUrl: REMOTE,
        timeoutMs: 1000
      })
    ).rejects.toMatchObject({ code: 'timeout' })
  })
})
