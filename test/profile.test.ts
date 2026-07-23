import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from '../src/args.js'
import { profileCommand, readProfileFile } from '../src/commands/profile.js'
import { assetsCommand } from '../src/commands/assets.js'
import { CliError } from '../src/errors.js'
import type { ApiClient } from '../src/client.js'
import type { BrandProfile } from '../src/types.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kursiva-cli-profile-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeJson(name: string, data: unknown): string {
  const path = join(dir, name)
  writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data))
  return path
}

describe('readProfileFile', () => {
  it('reads a group-nested object', () => {
    const path = writeJson('p.json', { business: { company_name: 'ACME' } })
    expect(readProfileFile(path)).toEqual({ business: { company_name: 'ACME' } })
  })

  it('rejects missing files, invalid JSON, and non-object roots', () => {
    expect(() => readProfileFile(join(dir, 'absent.json'))).toThrow(CliError)
    expect(() => readProfileFile(writeJson('bad.json', '{nope'))).toThrow(/valid JSON/)
    expect(() => readProfileFile(writeJson('arr.json', [1, 2]))).toThrow(/profile group/)
  })
})

describe('profileCommand', () => {
  it('set sends the file content; get prints the stored profile; clear deletes', async () => {
    const calls: string[] = []
    let stored: BrandProfile = {}
    const client = {
      getProfile: async () => {
        calls.push('get')
        return { profile: stored }
      },
      putProfile: async (profile: BrandProfile) => {
        calls.push('put')
        stored = profile
        return { profile }
      },
      deleteProfile: async () => {
        calls.push('delete')
        const had = Object.keys(stored).length > 0
        stored = {}
        return { deleted: had }
      }
    } as unknown as ApiClient

    const file = writeJson('p.json', { business: { company_name: 'ACME' } })
    expect(await profileCommand(parseArgs(['profile', 'set', file]), client, true)).toBe(0)
    expect(stored).toEqual({ business: { company_name: 'ACME' } })
    expect(await profileCommand(parseArgs(['profile', 'get']), client, true)).toBe(0)
    expect(await profileCommand(parseArgs(['profile', 'clear']), client, true)).toBe(0)
    expect(stored).toEqual({})
    expect(calls).toEqual(['put', 'get', 'delete'])
  })

  it('unknown subcommand → usage exit code', async () => {
    const client = {} as ApiClient
    expect(await profileCommand(parseArgs(['profile', 'frobnicate']), client, false)).toBe(1)
    expect(await profileCommand(parseArgs(['profile']), client, false)).toBe(1)
  })
})

describe('assetsCommand', () => {
  it('upload base64-encodes the file; list and rm round-trip', async () => {
    let uploaded = ''
    const id = `img_${'c'.repeat(24)}`
    const client = {
      uploadAsset: async (data: string) => {
        uploaded = data
        return { asset_id: id, content_type: 'image/png', width: 1, height: 1, bytes: 8 }
      },
      listAssets: async () => ({
        assets: [
          {
            asset_id: id,
            content_type: 'image/png',
            width: 1,
            height: 1,
            bytes: 8,
            created_at: '2026-07-24T00:00:00.000Z'
          }
        ]
      }),
      deleteAsset: async (assetId: string) => ({ deleted: assetId === id })
    } as unknown as ApiClient

    const img = join(dir, 'logo.png')
    writeFileSync(img, Buffer.from('PNGDATA'))
    expect(await assetsCommand(parseArgs(['assets', 'upload', img]), client, true)).toBe(0)
    expect(Buffer.from(uploaded, 'base64').toString()).toBe('PNGDATA')
    expect(await assetsCommand(parseArgs(['assets', 'list']), client, true)).toBe(0)
    expect(await assetsCommand(parseArgs(['assets', 'rm', id]), client, true)).toBe(0)
  })

  it('unknown subcommand → usage exit code', async () => {
    expect(await assetsCommand(parseArgs(['assets']), {} as ApiClient, false)).toBe(1)
  })
})
