import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { main } from '../src/main.js'
import { requireApiKey } from '../src/config.js'
import { CliError } from '../src/errors.js'

type FetchLike = (url: string, init: RequestInit) => Promise<unknown>

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data)
  }
}

const MINTED = { api_key: 'krsv_minted', key_id: 'k1', tier: 'free', monthly_quota: 20 }

let dir: string
let logs: string[]
let errs: string[]

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kursiva-signup-'))
  vi.stubEnv('XDG_CONFIG_HOME', dir)
  vi.stubEnv('KURSIVA_API_KEY', '')
  logs = []
  errs = []
  vi.spyOn(console, 'log').mockImplementation((m) => logs.push(String(m)))
  vi.spyOn(console, 'error').mockImplementation((m) => errs.push(String(m)))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  rmSync(dir, { recursive: true, force: true })
})

function configPath(): string {
  return join(dir, 'kursiva', 'config.json')
}

describe('kursiva signup', () => {
  it('POSTs the email without a bearer header and points at the verify step', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      jsonResponse({ status: 'verification_sent' }, 202)
    )
    vi.stubGlobal('fetch', fetchMock)

    const code = await main(['signup', 'a@b.co'])
    expect(code).toBe(0)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/signup')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.co' })
    expect((init.headers as Record<string, string>).authorization).toBeUndefined()
    expect(logs.join('\n')).toContain('kursiva signup verify a@b.co')
  })

  it('verify mints, prints, and stores the key with 0600', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(MINTED))
    vi.stubGlobal('fetch', fetchMock)

    const code = await main(['signup', 'verify', 'a@b.co', 'c0de'])
    expect(code).toBe(0)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      email: 'a@b.co',
      code: 'c0de'
    })
    expect(logs.join('\n')).toContain('krsv_minted')
    expect(JSON.parse(readFileSync(configPath(), 'utf-8')).apiKey).toBe('krsv_minted')
    expect(statSync(configPath()).mode & 0o777).toBe(0o600)
  })

  it('verify merges into an existing config, preserving apiUrl', async () => {
    mkdirSync(join(dir, 'kursiva'), { recursive: true })
    writeFileSync(configPath(), JSON.stringify({ apiUrl: 'http://api.test/v1' }))
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchLike>(async () => jsonResponse(MINTED))
    )

    await main(['signup', 'verify', 'a@b.co', 'c0de'])
    const stored = JSON.parse(readFileSync(configPath(), 'utf-8'))
    expect(stored).toEqual({ apiUrl: 'http://api.test/v1', apiKey: 'krsv_minted' })
  })

  it('verify never overwrites a different stored key', async () => {
    mkdirSync(join(dir, 'kursiva'), { recursive: true })
    writeFileSync(configPath(), JSON.stringify({ apiKey: 'krsv_precious' }))
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchLike>(async () => jsonResponse(MINTED))
    )

    const code = await main(['signup', 'verify', 'a@b.co', 'c0de'])
    expect(code).toBe(0)
    expect(JSON.parse(readFileSync(configPath(), 'utf-8')).apiKey).toBe('krsv_precious')
    expect(logs.join('\n')).toContain('NOT stored')
    expect(logs.join('\n')).toContain('krsv_minted')
  })

  it('--json emits the raw envelope on stdout, the storage note on stderr', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchLike>(async () => jsonResponse(MINTED))
    )

    const code = await main(['signup', 'verify', 'a@b.co', 'c0de', '--json'])
    expect(code).toBe(0)
    expect(JSON.parse(logs.join('\n'))).toEqual(MINTED)
    expect(errs.join('\n')).toContain('Stored in')
  })

  it('rejects missing arguments with a usage error', async () => {
    expect(await main(['signup'])).toBe(1)
    expect(await main(['signup', 'verify', 'a@b.co'])).toBe(1)
  })

  it('surfaces API rejections with the mapped exit code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchLike>(async () =>
        jsonResponse(
          { error: { code: 'invalid_verification', message: 'invalid or expired' } },
          400
        )
      )
    )
    expect(await main(['signup', 'verify', 'a@b.co', 'wrong'])).toBe(4)
  })
})

describe('requireApiKey', () => {
  it('names the signup command in the no-key error', () => {
    try {
      requireApiKey({ baseUrl: 'x', timeoutMs: 1 })
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(CliError)
      expect((err as CliError).message).toContain('kursiva signup')
    }
  })
})
