#!/usr/bin/env node
/**
 * [<]skrivelo CLI — executable entry. Wires argv → `main` → process exit code.
 */

import { main } from './main.js'

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code
  })
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
