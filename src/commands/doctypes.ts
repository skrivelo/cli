import { EXIT } from '../errors.js'
import { printJson } from '../output.js'
import type { ApiClient } from '../client.js'

export async function doctypesCommand(client: ApiClient, json: boolean): Promise<number> {
  const list = await client.doctypes()
  if (json) {
    printJson(list)
    return EXIT.OK
  }
  for (const d of list) {
    console.log(`${d.type.padEnd(20)} ${d.label} (${d.count})`)
  }
  return EXIT.OK
}
