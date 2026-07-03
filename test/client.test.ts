import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../src/client.js'
import { ApiError, CliError } from '../src/errors.js'

type FetchLike = (url: string, init: RequestInit) => Promise<unknown>

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data)
  }
}

function client() {
  return new ApiClient({ baseUrl: 'http://api.test/v1', apiKey: 'krsv_k', timeoutMs: 1000 })
}

afterEach(() => vi.unstubAllGlobals())

describe('ApiClient requests', () => {
  it('GETs /doctypes with the bearer key', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      jsonResponse([{ type: 'invoice', label: 'Invoice', count: 3 }])
    )
    vi.stubGlobal('fetch', fetchMock)
    const res = await client().doctypes()
    expect(res[0].type).toBe('invoice')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/v1/doctypes')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer krsv_k')
  })

  it('builds the search query string', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)
    await client().search({ query: 'quotation', doc_type: 'quotation' })
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://api.test/v1/templates?query=quotation&doc_type=quotation'
    )
  })

  it('URL-encodes the template id on describe', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse({ id: 'a/b' }))
    vi.stubGlobal('fetch', fetchMock)
    await client().describe('a/b')
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/v1/templates/a%2Fb')
  })

  it('POSTs the render body as JSON', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      jsonResponse({ document_url: 'file:///x', pages: 1, render_ms: 2, renderer_version: 'v' })
    )
    vi.stubGlobal('fetch', fetchMock)
    await client().render({ template_id: 't', content: { markdown: '# hi' } })
    const init = fetchMock.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({
      template_id: 't',
      content: { markdown: '# hi' }
    })
  })

  it('throws ApiError carrying the structured envelope on non-2xx', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      jsonResponse({ error: { code: 'quota_exceeded', message: 'over' }, quota: 20 }, 429)
    )
    vi.stubGlobal('fetch', fetchMock)
    await expect(client().doctypes()).rejects.toBeInstanceOf(ApiError)
    try {
      await client().doctypes()
    } catch (err) {
      const e = err as ApiError
      expect(e.status).toBe(429)
      expect(e.exitCode).toBe(3)
      expect(e.body.quota).toBe(20)
    }
  })

  it('synthesizes an envelope when the error body is not JSON', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => ({
      ok: false,
      status: 500,
      text: async () => '<html>oops'
    }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      await client().doctypes()
    } catch (err) {
      const e = err as ApiError
      expect(e.status).toBe(500)
      expect(e.body.error.code).toBe('http_error')
    }
  })

  it('maps an aborted request to a CliError timeout', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const fetchMock = vi.fn<FetchLike>(async () => {
      throw abort
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(client().doctypes()).rejects.toBeInstanceOf(CliError)
  })

  it('maps a network failure to a CliError', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => {
      throw new Error('ECONNREFUSED')
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      await client().doctypes()
    } catch (err) {
      expect(err).toBeInstanceOf(CliError)
      expect((err as CliError).code).toBe('network_error')
    }
  })
})
