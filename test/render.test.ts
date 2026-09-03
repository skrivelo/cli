import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from '../src/args.js'
import { renderCommand } from '../src/commands/render.js'
import { CliError } from '../src/errors.js'
import type { ApiClient } from '../src/client.js'
import type { RenderRequest, RenderResponse } from '../src/types.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'skrivelo-cli-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function fakeClient(capture: { body?: RenderRequest }, docUrl: string): ApiClient {
  return {
    baseUrl: 'http://127.0.0.1:8787/v1',
    timeoutMs: 30000,
    render: async (body: RenderRequest): Promise<RenderResponse> => {
      capture.body = body
      return {
        document_url: docUrl,
        pages: 2,
        render_ms: 5,
        renderer_version: 'test',
        catalog_version: 'cat'
      }
    }
  } as unknown as ApiClient
}

describe('renderCommand', () => {
  it('reads markdown, maps --field/--theme, downloads the file:// URL to -o', async () => {
    const md = join(dir, 'quote.md')
    writeFileSync(md, '# Quote\n')
    const srcPdf = join(dir, 'src.pdf')
    writeFileSync(srcPdf, '%PDF-1.4 test-bytes')
    const out = join(dir, 'out.pdf')

    const capture: { body?: RenderRequest } = {}
    const client = fakeClient(capture, pathToFileURL(srcPdf).href)
    const parsed = parseArgs([
      'render',
      md,
      '--template',
      'inv-1',
      '--field',
      'client=ACME',
      '--theme',
      '--accent=#0a5',
      '-o',
      out
    ])

    const code = await renderCommand(parsed, client, true)
    expect(code).toBe(0)
    // Leading `--` stripped from the theme key; fields mapped verbatim.
    expect(capture.body).toEqual({
      template_id: 'inv-1',
      content: { markdown: '# Quote\n', fields: { client: 'ACME' } },
      theme: { accent: '#0a5' }
    })
    expect(existsSync(out)).toBe(true)
    expect(readFileSync(out, 'utf-8')).toContain('%PDF')
  })

  it('maps --profile <file.json> onto the request body', async () => {
    const md = join(dir, 'invoice.md')
    writeFileSync(md, '# Invoice\n')
    const srcPdf = join(dir, 'src.pdf')
    writeFileSync(srcPdf, '%PDF-1.4')
    const profilePath = join(dir, 'brand.json')
    writeFileSync(profilePath, JSON.stringify({ business: { company_name: 'ACME' } }))
    const out = join(dir, 'out.pdf')

    const capture: { body?: RenderRequest } = {}
    const client = fakeClient(capture, pathToFileURL(srcPdf).href)
    const parsed = parseArgs([
      'render',
      md,
      '--template',
      'inv-1',
      '--profile',
      profilePath,
      '-o',
      out
    ])

    expect(await renderCommand(parsed, client, true)).toBe(0)
    expect(capture.body?.profile).toEqual({ business: { company_name: 'ACME' } })
  })

  it('derives the default output name from the input file', async () => {
    const md = join(dir, 'report.md')
    writeFileSync(md, '# Report\n')
    const srcPdf = join(dir, 'src.pdf')
    writeFileSync(srcPdf, '%PDF-1.4')
    const client = fakeClient({}, pathToFileURL(srcPdf).href)

    const cwd = process.cwd()
    process.chdir(dir)
    try {
      const parsed = parseArgs(['render', md, '--template', 't'])
      await renderCommand(parsed, client, true)
      expect(existsSync(join(dir, 'report.pdf'))).toBe(true)
    } finally {
      process.chdir(cwd)
    }
  })

  it('omits content.fields and theme when none are given', async () => {
    const md = join(dir, 'q.md')
    writeFileSync(md, 'hi')
    const srcPdf = join(dir, 'src.pdf')
    writeFileSync(srcPdf, '%PDF')
    const capture: { body?: RenderRequest } = {}
    const client = fakeClient(capture, pathToFileURL(srcPdf).href)
    const parsed = parseArgs(['render', md, '--template', 't', '-o', join(dir, 'o.pdf')])
    await renderCommand(parsed, client, true)
    expect(capture.body).toEqual({ template_id: 't', content: { markdown: 'hi' } })
  })

  it('throws when --template is missing', async () => {
    const md = join(dir, 'q.md')
    writeFileSync(md, 'hi')
    const client = fakeClient({}, 'file:///x')
    await expect(renderCommand(parseArgs(['render', md]), client, false)).rejects.toBeInstanceOf(
      CliError
    )
  })

  it('throws when the input file is unreadable', async () => {
    const client = fakeClient({}, 'file:///x')
    const parsed = parseArgs(['render', join(dir, 'nope.md'), '--template', 't'])
    await expect(renderCommand(parsed, client, false)).rejects.toBeInstanceOf(CliError)
  })
})
