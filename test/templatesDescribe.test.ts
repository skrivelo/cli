import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseArgs } from '../src/args.js'
import { templatesDescribeCommand } from '../src/commands/templatesDescribe.js'
import { EXIT } from '../src/errors.js'
import type { ApiClient } from '../src/client.js'
import type { TemplateContract } from '../src/types.js'

const contract = (content_prompt: string | null): TemplateContract => ({
  id: 'crisp-invoice-invoice',
  doc_type: 'invoice',
  name: 'Crisp Invoice',
  content_fields: [{ key: 'client', label: 'Client', type: 'text', required: true }],
  theme_tokens: [{ name: '--accent', default: '#d94545', type: 'color' }],
  locales: ['en', 'de'],
  page_format: { width: 210, height: 297, unit: 'mm' },
  sample_payload: { markdown: '# Invoice', fields: { client: 'ACME' } },
  catalog_version: 'c0ffee01',
  free_tier: true,
  content_prompt
})

const clientFor = (c: TemplateContract): ApiClient =>
  ({ describe: async () => c }) as unknown as ApiClient

let logged: string[]

beforeEach(() => {
  logged = []
  vi.spyOn(console, 'log').mockImplementation((line: string) => {
    logged.push(line)
  })
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('templatesDescribeCommand', () => {
  it('prints the content rules block, exact and line-indented, when the author declares any', async () => {
    const rules = 'Totals exclude VAT.\nList VAT as its own line.'
    const parsed = parseArgs(['templates', 'describe', 'crisp-invoice-invoice'])
    const code = await templatesDescribeCommand(parsed, clientFor(contract(rules)), false)

    expect(code).toBe(EXIT.OK)
    const out = logged.join('\n')
    expect(out).toContain('content rules (follow when generating content):')
    expect(out).toContain('  Totals exclude VAT.')
    expect(out).toContain('  List VAT as its own line.')
  })

  it('prints no content rules block when the template declares none', async () => {
    const parsed = parseArgs(['templates', 'describe', 'crisp-invoice-invoice'])
    const code = await templatesDescribeCommand(parsed, clientFor(contract(null)), false)

    expect(code).toBe(EXIT.OK)
    expect(logged.join('\n')).not.toContain('content rules')
  })

  it('retains content_prompt in --json output', async () => {
    const rules = 'Totals exclude VAT.'
    const parsed = parseArgs(['templates', 'describe', 'crisp-invoice-invoice', '--json'])
    const code = await templatesDescribeCommand(parsed, clientFor(contract(rules)), true)

    expect(code).toBe(EXIT.OK)
    expect(JSON.parse(logged.join('\n')).content_prompt).toBe(rules)
  })
})
