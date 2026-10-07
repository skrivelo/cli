import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { parseKvPairs } from '../args.js'
import { readProfileFile } from './profile.js'
import { downloadTo } from '../download.js'
import { CliError, EXIT } from '../errors.js'
import { BRANDING, printJson } from '../output.js'
import type { ApiClient } from '../client.js'
import type { ParsedArgs } from '../args.js'
import type { RenderContent, RenderRequest } from '../types.js'

export async function renderCommand(
  parsed: ParsedArgs,
  client: ApiClient,
  json: boolean
): Promise<number> {
  // positionals: ['render', <file.md>]
  const file = parsed.positionals[1]
  if (!file) throw new CliError('Usage: skrivelo render <file.md> --template <id> [options]')

  const templateId = parsed.options['--template']
  if (!templateId) throw new CliError('Missing --template <id>.')

  let markdown: string
  try {
    markdown = readFileSync(resolve(file), 'utf-8')
  } catch (err) {
    throw new CliError(`Cannot read "${file}": ${(err as NodeJS.ErrnoException).message}`)
  }

  const fields = parseKvPairs(parsed.repeated['--field'])
  const theme = parseKvPairs(parsed.repeated['--theme'], { stripLeadingDashes: true })

  const content: RenderContent = { markdown }
  if (Object.keys(fields).length > 0) content.fields = fields
  const body: RenderRequest = { template_id: templateId, content }
  if (Object.keys(theme).length > 0) body.theme = theme
  if (parsed.options['--locale']) body.locale = parsed.options['--locale']
  if (parsed.options['--profile-id']) body.profile_id = parsed.options['--profile-id']
  if (parsed.options['--profile']) body.profile = readProfileFile(parsed.options['--profile'])

  const res = await client.render(body)
  const outPath = resolve(parsed.options['--output'] ?? defaultOutName(file))
  await downloadTo(res.document_url, outPath, {
    baseUrl: client.baseUrl,
    timeoutMs: client.timeoutMs
  })

  if (json) {
    printJson({ ...res, output_path: outPath })
    return EXIT.OK
  }
  console.log(`${outPath} (${res.pages} page${res.pages === 1 ? '' : 's'}, ${res.render_ms} ms)`)
  console.log(BRANDING)
  return EXIT.OK
}

function defaultOutName(file: string): string {
  return basename(file).replace(/\.[^.]+$/, '') + '.pdf'
}
