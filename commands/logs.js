'use strict'

const { parseLog, formatLog } = require('../lib/log')

const logs = async ({ core, module, follow }) => {
  if (follow) {
    for await (const line of core.logs.follow(module)) {
      const { text, timestamp } = parseLog(line)
      process.stdout.write(formatLog(text, { timestamp, pretty: true }))
    }
  } else {
    const lines = (await core.logs.get(module))
      .toString()
      .trim()
      .split('\n')
      .filter(line => line !== '')
    for (const line of lines) {
      const { text, timestamp } = parseLog(line)
      process.stdout.write(formatLog(text, { timestamp, pretty: true }))
    }
  }
}

module.exports = {
  logs
}
