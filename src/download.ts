/**
 * Download a rendered document to disk. Production hands back an `https://`
 * signed URL; a locally-run API hands back a `file://` path — the CLI resolves
 * both so the same code path works against a local instance and the deployed API.
 */

import { writeFile, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { CliError } from './errors.js'

export async function downloadTo(url: string, outPath: string): Promise<void> {
  if (url.startsWith('file://')) {
    await copyFile(fileURLToPath(url), outPath)
    return
  }

  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    throw new CliError(`Failed to download document: ${(err as Error).message}`)
  }
  if (!res.ok) {
    throw new CliError(`Failed to download document: HTTP ${res.status}`)
  }
  await writeFile(outPath, Buffer.from(await res.arrayBuffer()))
}
