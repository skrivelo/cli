import { describe, expect, it } from 'vitest'
import { parseArgs, parseKvPairs } from '../src/args.js'
import { CliError } from '../src/errors.js'

describe('parseArgs', () => {
  it('collects positionals and both flag-value forms', () => {
    const r = parseArgs(['templates', 'search', 'quotation', '--type', 'quotation', '--locale=de'])
    expect(r.positionals).toEqual(['templates', 'search', 'quotation'])
    expect(r.options['--type']).toBe('quotation')
    expect(r.options['--locale']).toBe('de')
  })

  it('collects boolean flags', () => {
    const r = parseArgs(['doctypes', '--json'])
    expect(r.flags.has('--json')).toBe(true)
  })

  it('resolves -o and -h aliases', () => {
    const r = parseArgs(['render', 'q.md', '-o', 'out.pdf', '-h'])
    expect(r.options['--output']).toBe('out.pdf')
    expect(r.flags.has('--help')).toBe(true)
  })

  it('repeats --field/--theme and consumes leading-dash values literally', () => {
    const r = parseArgs([
      'render',
      'q.md',
      '--field',
      'client=ACME',
      '--field',
      'due=2026-01',
      '--theme',
      '--accent=#0a5',
      '--theme=color-bg=#fff'
    ])
    expect(r.repeated['--field']).toEqual(['client=ACME', 'due=2026-01'])
    expect(r.repeated['--theme']).toEqual(['--accent=#0a5', 'color-bg=#fff'])
  })

  it('throws on an unknown flag', () => {
    expect(() => parseArgs(['doctypes', '--bogus'])).toThrow(CliError)
  })

  it('throws on a missing value for a string option', () => {
    expect(() => parseArgs(['render', 'q.md', '--template'])).toThrow(/Missing value/)
  })

  it('throws when a boolean flag is given a value', () => {
    expect(() => parseArgs(['doctypes', '--json=1'])).toThrow(/does not take a value/)
  })
})

describe('parseKvPairs', () => {
  it('splits on the first = only', () => {
    expect(parseKvPairs(['a=b=c'])).toEqual({ a: 'b=c' })
  })

  it('strips one leading -- from keys when asked', () => {
    expect(parseKvPairs(['--accent=#0a5'], { stripLeadingDashes: true })).toEqual({
      accent: '#0a5'
    })
  })

  it('keeps keys verbatim by default', () => {
    expect(parseKvPairs(['client=ACME'])).toEqual({ client: 'ACME' })
  })

  it('throws on a value with no =', () => {
    expect(() => parseKvPairs(['bogus'])).toThrow(CliError)
  })
})
