/**
 * `kursiva assets list|upload|rm` — durable per-account images (Lite+). Upload
 * a logo once, reference its `img_…` id from the profile or image fields; the
 * server resizes and inlines it at render.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CliError, EXIT } from '../errors.js'
import { printJson } from '../output.js'
import type { ApiClient } from '../client.js'
import type { ParsedArgs } from '../args.js'

const USAGE = `Usage:
  kursiva assets list                 list uploaded assets and their img_… ids
  kursiva assets upload <image>       upload an image (png/jpeg/webp/gif) — prints its img_… id
  kursiva assets rm <img_id>          delete an asset`

export async function assetsCommand(
  parsed: ParsedArgs,
  client: ApiClient,
  json: boolean
): Promise<number> {
  const sub = parsed.positionals[1]

  if (sub === 'list') {
    const res = await client.listAssets()
    if (json) {
      printJson(res)
      return EXIT.OK
    }
    if (res.assets.length === 0) {
      console.log('No assets uploaded. `kursiva assets upload <image>` stores one.')
      return EXIT.OK
    }
    for (const a of res.assets) {
      console.log(
        `${a.asset_id}  ${a.content_type.padEnd(12)} ${String(a.width).padStart(5)}×${String(a.height).padEnd(5)} ${a.bytes} bytes  ${a.created_at}`
      )
    }
    return EXIT.OK
  }

  if (sub === 'upload') {
    const file = parsed.positionals[2]
    if (!file) throw new CliError(USAGE)
    let data: Buffer
    try {
      data = readFileSync(resolve(file))
    } catch (err) {
      throw new CliError(`Cannot read "${file}": ${(err as NodeJS.ErrnoException).message}`)
    }
    const res = await client.uploadAsset(data.toString('base64'))
    if (json) printJson(res)
    else console.log(`${res.asset_id} (${res.width}×${res.height}, ${res.bytes} bytes)`)
    return EXIT.OK
  }

  if (sub === 'rm') {
    const id = parsed.positionals[2]
    if (!id) throw new CliError(USAGE)
    const res = await client.deleteAsset(id)
    if (json) printJson(res)
    else console.log(res.deleted ? `Deleted ${id}.` : `${id} not found.`)
    return EXIT.OK
  }

  console.error(USAGE)
  return EXIT.USAGE
}
