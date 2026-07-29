// The CLI's request/response types must stay aligned with the published
// contract. This test validates representative fixtures — typed as the CLI's own
// interfaces — against the vendored `contract/openapi.yaml` component schemas
// (the sole contract artifact this repo consumes). Uses Ajv 2020 (OpenAPI 3.1's
// dialect), the same validator the API runtime uses.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { describe, expect, it } from 'vitest'
import type {
  ApiErrorBody,
  AssetListResponse,
  DocType,
  ProfileResponse,
  RenderRequest,
  RenderResponse,
  SignupAccepted,
  SignupKeyResponse,
  TemplateCard,
  TemplateContract
} from '../src/types.js'

// ajv + ajv-formats ship CommonJS; load them via require so NodeNext ESM interop
// doesn't mis-resolve their default export to the module namespace. We type only
// the small surface we use.
type ValidateFn = ((data: unknown) => boolean) & { errors?: unknown }
interface AjvLike {
  addSchema(schema: unknown, key: string): void
  getSchema(ref: string): ValidateFn | undefined
}
const require = createRequire(import.meta.url)
const Ajv2020 = require('ajv/dist/2020.js') as new (opts?: object) => AjvLike
const addFormats = require('ajv-formats') as (ajv: AjvLike) => void

const specPath = fileURLToPath(new URL('../contract/openapi.yaml', import.meta.url))
const ajv = new Ajv2020({ strict: false, allErrors: true })
addFormats(ajv)
ajv.addSchema(parseYaml(readFileSync(specPath, 'utf-8')), 'openapi')

function assertValid(schemaName: string, data: unknown): void {
  const validate = ajv.getSchema(`openapi#/components/schemas/${schemaName}`)
  if (!validate) throw new Error(`No schema "${schemaName}" in contract/openapi.yaml`)
  const ok = validate(data)
  if (!ok) {
    throw new Error(`${schemaName} violations:\n${JSON.stringify(validate.errors, null, 2)}`)
  }
  expect(ok).toBe(true)
}

describe('CLI types validate against the vendored contract', () => {
  it('DocType', () => {
    const fixture: DocType = { type: 'invoice', label: 'Invoice', count: 42 }
    assertValid('DocType', fixture)
  })

  it('DocType with the brand-payload contract', () => {
    const fixture: DocType = {
      type: 'invoice',
      label: 'Invoice',
      count: 42,
      profile_group: 'business',
      profile_fields: [
        { key: 'company_name', type: 'text' },
        { key: 'company_logo', type: 'image' }
      ]
    }
    assertValid('DocType', fixture)
  })

  it('TemplateCard', () => {
    const fixture: TemplateCard = {
      id: 'crisp-invoice-invoice',
      name: 'Crisp Invoice',
      doc_type: 'invoice',
      summary: 'A clean single-column invoice.',
      free_tier: true
    }
    assertValid('TemplateCard', fixture)
  })

  it('TemplateContract', () => {
    const fixture: TemplateContract = {
      id: 'crisp-invoice-invoice',
      doc_type: 'invoice',
      name: 'Crisp Invoice',
      content_fields: [
        { key: 'client', label: 'Client', type: 'text', required: true },
        { key: 'due_date', label: 'Due date', type: 'date', required: false, default: '2026-01-01' }
      ],
      theme_tokens: [{ name: '--accent', default: '#d94545', type: 'color' }],
      locales: ['en', 'de'],
      page_format: { width: 210, height: 297, unit: 'mm' },
      sample_payload: { markdown: '# Invoice', fields: { client: 'ACME' } },
      catalog_version: 'c0ffee01',
      free_tier: false,
      content_prompt: 'Invoice totals exclude VAT; list it as a separate line.'
    }
    assertValid('TemplateContract', fixture)
    // The corpus serves null for templates that declare no content rules.
    assertValid('TemplateContract', { ...fixture, content_prompt: null })
  })

  it('RenderRequest (what the CLI sends)', () => {
    const fixture: RenderRequest = {
      template_id: 'crisp-invoice-invoice',
      content: { markdown: '# Invoice', fields: { client: 'ACME' } },
      theme: { accent: '#0a5' },
      locale: 'en'
    }
    assertValid('RenderRequest', fixture)
  })

  it('RenderRequest with a per-request brand profile', () => {
    const fixture: RenderRequest = {
      template_id: 'crisp-invoice-invoice',
      content: { markdown: '# Invoice' },
      profile: {
        business: { company_name: 'ACME GmbH', company_logo: `img_${'a'.repeat(24)}` }
      }
    }
    assertValid('RenderRequest', fixture)
  })

  it('ProfileResponse (what profile get/set read)', () => {
    const fixture: ProfileResponse = {
      profile: { business: { company_name: 'ACME GmbH', tax_id: 'DE123456789' } }
    }
    assertValid('ProfileResponse', fixture)
    assertValid('ProfilePutRequest', fixture)
  })

  it('AssetListResponse (what assets list reads)', () => {
    const fixture: AssetListResponse = {
      assets: [
        {
          asset_id: `img_${'b'.repeat(24)}`,
          content_type: 'image/png',
          width: 320,
          height: 96,
          bytes: 4096,
          created_at: '2026-07-24T00:00:00.000Z'
        }
      ]
    }
    assertValid('AssetListResponse', fixture)
  })

  it('RenderResponse (what the CLI reads)', () => {
    const fixture: RenderResponse = {
      document_url: 'https://storage.example/doc.pdf?sig=…',
      pages: 3,
      render_ms: 2760,
      renderer_version: 'r1',
      catalog_version: 'c0ffee01'
    }
    assertValid('RenderResponse', fixture)
  })

  it('SignupAccepted (what signup reads)', () => {
    const fixture: SignupAccepted = { status: 'verification_sent' }
    assertValid('SignupAccepted', fixture)
  })

  it('SignupKeyResponse (what signup verify reads)', () => {
    const fixture: SignupKeyResponse = {
      api_key: 'krsv_minted',
      key_id: 'key_01',
      tier: 'free',
      monthly_quota: 20,
      rotated: false
    }
    assertValid('SignupKeyResponse', fixture)
  })

  it('Error envelope with extras', () => {
    const fixture: ApiErrorBody = {
      error: {
        code: 'quota_exceeded',
        message: 'Monthly quota reached.',
        hint: 'Upgrade for more.'
      },
      quota: 20,
      used: 20,
      period: '2026-07'
    }
    assertValid('Error', fixture)
  })

  it('Error envelope carrying unrenderable_svg findings (422)', () => {
    const fixture: ApiErrorBody = {
      error: {
        code: 'unrenderable_svg',
        message: 'The content carries an SVG construct the renderer cannot reproduce.'
      },
      findings: [
        {
          elementPath: 'data-uri[0]:/svg/rect[1]',
          primitives: ['feGaussianBlur'],
          reason: 'unsupported'
        }
      ]
    }
    assertValid('Error', fixture)
  })
})
