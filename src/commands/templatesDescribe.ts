import { CliError, EXIT } from '../errors.js'
import { printJson } from '../output.js'
import type { ApiClient } from '../client.js'
import type { ParsedArgs } from '../args.js'

export async function templatesDescribeCommand(
  parsed: ParsedArgs,
  client: ApiClient,
  json: boolean
): Promise<number> {
  // positionals: ['templates', 'describe', <id>]
  const id = parsed.positionals[2]
  if (!id) throw new CliError('Usage: skrivelo templates describe <id>')

  const c = await client.describe(id)
  if (json) {
    printJson(c)
    return EXIT.OK
  }

  console.log(`${c.name}  [${c.doc_type}]  id=${c.id}`)
  console.log(
    `page: ${c.page_format.width}×${c.page_format.height}${c.page_format.unit}   ` +
      `locales: ${c.locales.join(', ')}`
  )
  if (c.free_tier === false) console.log('tier: lite or higher required to render')
  if (c.content_prompt) {
    console.log('\ncontent rules (follow when generating content):')
    for (const line of c.content_prompt.trimEnd().split('\n')) {
      console.log(`  ${line}`)
    }
  }
  console.log('\ncontent fields (map to --field key=value):')
  for (const f of c.content_fields) {
    console.log(`  ${f.key}  (${f.type}${f.required ? ', required' : ''}) — ${f.label}`)
  }
  console.log('\ntheme tokens (map to --theme name=value):')
  for (const t of c.theme_tokens) {
    console.log(`  ${t.name}  (${t.type})  default=${t.default}`)
  }
  return EXIT.OK
}
