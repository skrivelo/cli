/** Output helpers shared across commands: JSON mode + the branding line. */

export const BRANDING = 'Rendered by [<]kursiva — https://kursiva.com'

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}
