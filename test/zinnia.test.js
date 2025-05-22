// Unit test for maybeReportErrorToSentry using dependency-injected spy.
// This avoids mocking ESM modules directly.
import assert from 'node:assert'
import sinon from 'sinon'
import { maybeReportErrorToSentry } from '../lib/zinnia.js'

describe('maybeReportErrorToSentry', () => {
  it('should NOT report error when reportToSentry is false', () => {
    // Inject spy instead of using real Sentry
    const spy = sinon.spy()
    const error = new Error('Expected error')
    error.reportToSentry = false

    maybeReportErrorToSentry(error, spy)
    assert.strictEqual(spy.called, false)
  })

  it('should report error when reportToSentry is not set', () => {
    const spy = sinon.spy()
    const error = new Error('Unexpected error')

    maybeReportErrorToSentry(error, spy)
    assert.strictEqual(spy.called, true)
  })
})
