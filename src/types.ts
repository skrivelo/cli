/**
 * TypeScript mirror of the [<]skrivelo Render API contract (`contract/openapi.yaml`).
 * These are the response and request shapes the CLI reads and writes; the
 * vendored OpenAPI spec is the source of truth (see `test/contract.test.ts`).
 */

export interface DocType {
  type: string
  label: string
  count: number
  /** Profile group this type reads brand identity from — the top-level profile key. */
  profile_group?: string
  /** Profile fields templates of this type may render (brand-payload contract). */
  profile_fields?: { key: string; type: string }[]
}

export interface TemplateCard {
  id: string
  name: string
  doc_type: string
  summary: string
  /** Renderable on the free tier; false ⇒ render requires lite or higher. */
  free_tier: boolean
}

export type ContentFieldType =
  'text' | 'textarea' | 'date' | 'serial' | 'block' | 'qrcode' | 'barcode' | 'image'

export interface ContentField {
  key: string
  label: string
  type: ContentFieldType
  required: boolean
  /** Literal string default, or a per-language map. */
  default?: string | Record<string, string>
}

export type ThemeTokenType = 'color' | 'length' | 'font' | 'string'

export interface ThemeToken {
  name: string
  default: string
  type: ThemeTokenType
}

export interface PageFormat {
  width: number
  height: number
  unit: string
}

export interface SamplePayload {
  markdown: string
  fields: Record<string, unknown>
}

export interface TemplateContract {
  id: string
  doc_type: string
  name: string
  content_fields: ContentField[]
  theme_tokens: ThemeToken[]
  locales: string[]
  page_format: PageFormat
  sample_payload: SamplePayload
  /** Content hash of the corpus snapshot this contract was built from. */
  catalog_version: string
  /** Renderable on the free tier; false ⇒ render requires lite or higher. */
  free_tier: boolean
  /** The template author's content rules — advisory, never enforced by render; honour them when generating content. */
  content_prompt: string | null
}

export interface RenderContent {
  markdown?: string
  fields?: Record<string, unknown>
}

export interface RenderRequest {
  template_id: string
  profile_id?: string
  content?: RenderContent
  theme?: Record<string, string>
  locale?: string
  /** Per-document field overrides; wins per key over the stored profile. */
  profile?: BrandProfile
  options?: Record<string, unknown>
}

/** Brand identity nested by profile group → field key → value.
 *  Image-type fields take an uploaded `img_…` asset ref. */
export type BrandProfile = Record<string, Record<string, string | number>>

export interface ProfileResponse {
  profile: BrandProfile
}

export interface AssetUploadResponse {
  asset_id: string
  content_type: string
  width: number
  height: number
  bytes: number
}

export interface AssetInfo extends AssetUploadResponse {
  created_at: string
}

export interface AssetListResponse {
  assets: AssetInfo[]
}

export interface DeleteResponse {
  deleted: boolean
}

/** A non-fatal render warning; only `mermaid_render_failed` is emitted today. */
export interface RenderWarning {
  code: 'mermaid_render_failed'
  count: number
}

export interface RenderResponse {
  document_url: string
  pages: number
  render_ms: number
  renderer_version: string
  /** Corpus snapshot hash; with renderer_version it pins render reproducibility. */
  catalog_version: string
  /** Present only when non-empty (omitted for a clean render). */
  warnings?: RenderWarning[]
}

export interface SignupAccepted {
  status: string
}

export interface SignupKeyResponse {
  /** The Free-tier key — returned exactly once; the CLI stores it on receipt. */
  api_key: string
  key_id: string
  tier: string
  monthly_quota: number
  /** True when a previously issued key for this email was revoked and replaced. */
  rotated: boolean
}

/** One SVG region the render cannot reproduce — carried by `unrenderable_svg` (422). */
export interface FilterFinding {
  /** Set only when the finding came from a named file (e.g. a pushed bundle). */
  file?: string
  /** Locator within the document, e.g. `data-uri[0]:/svg/rect[1]`. */
  elementPath: string
  /** The offending filter primitives or mask conditions, e.g. `feGaussianBlur`. */
  primitives: string[]
  reason: 'unsupported' | 'external-resource' | 'too-large'
}

/** The structured error envelope every non-2xx response carries. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    hint?: string
  }
  pages_produced?: number
  cap?: number
  retry_after?: number
  quota?: number
  used?: number
  period?: string
  limit?: number
  limit_bytes?: number
  findings?: FilterFinding[]
}
