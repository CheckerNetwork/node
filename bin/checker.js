#!/usr/bin/env node

import { checker } from '../commands/checker.js'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'node:fs/promises'
import * as paths from '../lib/paths.js'
import { maybeMigrateRuntimeState } from '../lib/migrate.js'

const pkg = JSON.parse(await fs.readFile(paths.packageJSON, 'utf8'))

await maybeMigrateRuntimeState()

yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .command(
    '$0',
    'Start Checker',
    (yargs) =>
      yargs
        .option('json', {
          alias: 'j',
          type: 'boolean',
          description: 'Output JSON',
        })
        .option('experimental', {
          type: 'boolean',
          description: 'Also run experimental subnets',
        })
        .option('recreateCheckerIdOnError', {
          type: 'boolean',
          description: 'Recreate Checker ID if it is corrupted',
        }),
    ({ json, experimental, recreateCheckerIdOnError }) =>
      checker({ json, experimental, recreateCheckerIdOnError }),
  )
  .version(`${pkg.name}: ${pkg.version}`)
  .alias('v', 'version')
  .alias('h', 'help')
  .parse()
