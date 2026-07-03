/**
 * Thin HTTP client for the Kursiva Render API. Sends the bearer key, JSON-encodes
 * request bodies, and turns any non-2xx into an `ApiError` carrying the structured
 * envelope (so the exit-code mapping works). A generous timeout absorbs the render
 * slow tail; on timeout/network failure it raises a `CliError`.
 */

import { ApiError, CliError } from './errors.js'
import type {
  ApiErrorBody,
  DocType,
  RenderRequest,
  RenderResponse,
  TemplateCard,
  TemplateContract
} from './types.js'

export interface ApiClientOptions {
  baseUrl: string
  apiKey: string
  timeoutMs: number
}

export interface SearchParams {
  query?: string
  doc_type?: string
  locale?: string
}

export class ApiClient {
  private readonly opts: ApiClientOptions

  constructor(opts: ApiClientOptions) {
    this.opts = opts
  }

  doctypes(): Promise<DocType[]> {
    return this.request<DocType[]>('GET', '/doctypes')
  }

  search(params: SearchParams): Promise<TemplateCard[]> {
    const qs = new URLSearchParams()
    if (params.query) qs.set('query', params.query)
    if (params.doc_type) qs.set('doc_type', params.doc_type)
    if (params.locale) qs.set('locale', params.locale)
    const q = qs.toString()
    return this.request<TemplateCard[]>('GET', `/templates${q ? `?${q}` : ''}`)
  }

  describe(id: string): Promise<TemplateContract> {
    return this.request<TemplateContract>('GET', `/templates/${encodeURIComponent(id)}`)
  }

  render(body: RenderRequest): Promise<RenderResponse> {
    return this.request<RenderResponse>('POST', '/render', body)
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs)
    let res: Response
    try {
      res = await fetch(`${this.opts.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.opts.apiKey}`,
          accept: 'application/json',
          ...(body !== undefined ? { 'content-type': 'application/json' } : {})
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new CliError(
          `Request timed out after ${Math.round(this.opts.timeoutMs / 1000)}s. ` +
            `Increase --timeout for large documents.`,
          { code: 'timeout' }
        )
      }
      throw new CliError(
        `Network error contacting ${this.opts.baseUrl}: ${(err as Error).message}`,
        {
          code: 'network_error'
        }
      )
    } finally {
      clearTimeout(timer)
    }

    const text = await res.text()
    if (!res.ok) {
      throw new ApiError(res.status, parseErrorBody(text, res.status))
    }
    return (text ? JSON.parse(text) : undefined) as T
  }
}

function parseErrorBody(text: string, status: number): ApiErrorBody {
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      return parsed as ApiErrorBody
    }
  } catch {
    // not JSON — fall through
  }
  return { error: { code: 'http_error', message: `HTTP ${status}` } }
}
