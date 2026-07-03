import { describe, expect, it } from 'vitest'
import { ApiError, CliError, EXIT, exitCodeForStatus } from '../src/errors.js'

describe('exitCodeForStatus', () => {
  it('maps each documented status to its distinct code', () => {
    expect(exitCodeForStatus(401)).toBe(EXIT.AUTH) // 2
    expect(exitCodeForStatus(429)).toBe(EXIT.QUOTA) // 3
    expect(exitCodeForStatus(400)).toBe(EXIT.BAD_REQUEST) // 4
    expect(exitCodeForStatus(404)).toBe(EXIT.NOT_FOUND) // 5
    expect(exitCodeForStatus(413)).toBe(EXIT.TOO_LARGE) // 6
  })

  it('maps 5xx and anything unmapped to the server code', () => {
    expect(exitCodeForStatus(500)).toBe(EXIT.SERVER) // 7
    expect(exitCodeForStatus(502)).toBe(EXIT.SERVER)
    expect(exitCodeForStatus(418)).toBe(EXIT.SERVER)
  })
})

describe('ApiError', () => {
  it('derives exitCode from status and carries the envelope', () => {
    const err = new ApiError(429, {
      error: { code: 'quota_exceeded', message: 'over' },
      quota: 20,
      used: 20,
      period: '2026-07'
    })
    expect(err.exitCode).toBe(EXIT.QUOTA)
    expect(err.body.quota).toBe(20)
  })
})

describe('CliError', () => {
  it('defaults to the usage exit code', () => {
    expect(new CliError('bad').exitCode).toBe(EXIT.USAGE)
  })

  it('honours an explicit exit code (e.g. missing key → auth)', () => {
    expect(new CliError('no key', { exitCode: EXIT.AUTH, code: 'no_api_key' }).exitCode).toBe(
      EXIT.AUTH
    )
  })
})
