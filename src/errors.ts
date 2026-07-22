/**
 * Error types + the HTTP-status → process-exit-code table. Scripting agents key
 * off the exit code, so the mapping is a stable part of the contract: distinct
 * codes for auth, quota, cap, and server failure (per the Phase 7 surface).
 */

import type { ApiErrorBody } from './types.js'

export const EXIT = {
  OK: 0,
  /** Usage / bad args / unreadable file / network / timeout. */
  USAGE: 1,
  /** 401 — missing or invalid API key. */
  AUTH: 2,
  /** 429 — per-key rate limit or monthly quota exhausted. */
  QUOTA: 3,
  /** 400 — invalid request, unknown theme token, or page-cap exceeded. */
  BAD_REQUEST: 4,
  /** 404 — unknown template id. */
  NOT_FOUND: 5,
  /** 413 — request body or embedded-image count over the input cap. */
  TOO_LARGE: 6,
  /** 5xx / anything else — renderer or ledger failure. */
  SERVER: 7,
  /** 403 — the key's tier is below what the operation requires (insufficient_tier). */
  FORBIDDEN: 8
} as const

export function exitCodeForStatus(status: number): number {
  switch (status) {
    case 401:
      return EXIT.AUTH
    case 403:
      return EXIT.FORBIDDEN
    case 429:
      return EXIT.QUOTA
    case 400:
      return EXIT.BAD_REQUEST
    case 404:
      return EXIT.NOT_FOUND
    case 413:
      return EXIT.TOO_LARGE
    default:
      return EXIT.SERVER
  }
}

/** A non-2xx response from the API, carrying the structured error envelope. */
export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.error?.message ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }

  get exitCode(): number {
    return exitCodeForStatus(this.status)
  }
}

/** A local failure (bad args, unreadable file, missing key, network/timeout). */
export class CliError extends Error {
  readonly exitCode: number
  readonly code: string

  constructor(message: string, opts?: { exitCode?: number; code?: string }) {
    super(message)
    this.name = 'CliError'
    this.exitCode = opts?.exitCode ?? EXIT.USAGE
    this.code = opts?.code ?? 'cli_error'
  }
}
