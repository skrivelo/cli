import { EXIT } from '../errors.js'
import { printJson } from '../output.js'
import type { ApiClient } from '../client.js'
import type { ParsedArgs } from '../args.js'

export async function templatesSearchCommand(
  parsed: ParsedArgs,
  client: ApiClient,
  json: boolean
): Promise<number> {
  // positionals: ['templates', 'search', <query?>]
  const query = parsed.positionals[2]
  const cards = await client.search({
    query,
    doc_type: parsed.options['--type'],
    locale: parsed.options['--locale']
  })

  if (json) {
    printJson(cards)
    return EXIT.OK
  }
  if (cards.length === 0) {
    console.log('No templates found.')
    return EXIT.OK
  }
  for (const c of cards) {
    console.log(`${c.id}\t${c.name} [${c.doc_type}] — ${c.summary}`)
  }
  return EXIT.OK
}
