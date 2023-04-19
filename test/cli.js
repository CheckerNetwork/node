import assert from 'node:assert'
import { execa } from 'execa'
import { station, FIL_WALLET_ADDRESS } from './util.js'
import { once } from 'node:events'

describe('CLI', () => {
  describe('FIL_WALLET_ADDRESS', () => {
    it('fails without address', async () => {
      await assert.rejects(execa(station))
    })
    it('works with address', async () => {
      const ps = execa(station, { env: { FIL_WALLET_ADDRESS } })
      await once(ps.stdout, 'data')
      ps.kill()
    })
  })

  describe('--version', () => {
    it('outputs version', async () => {
      await execa(station, ['--version'])
      await execa(station, ['-v'])
    })
  })

  describe('--help', () => {
    it('outputs help text', async () => {
      await execa(station, ['--help'])
      await execa(station, ['-h'])
    })
  })
})
