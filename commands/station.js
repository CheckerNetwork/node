import { join } from 'node:path'
import { paths } from '../lib/paths.js'
import * as saturnNode from '../lib/saturn-node.js'
import * as zinniaRuntime from '../lib/zinnia.js'
import { createLogStream } from '../lib/log.js'
import { createMetricsStream } from '../lib/metrics.js'
import { createActivityStream } from '../lib/activity.js'
import lockfile from 'proper-lockfile'
import { maybeCreateFile } from '../lib/util.js'
import { startPingLoop } from '../lib/telemetry.js'

const { FIL_WALLET_ADDRESS, MAX_DISK_SPACE } = process.env

export const station = async () => {
  if (!FIL_WALLET_ADDRESS) {
    console.error('FIL_WALLET_ADDRESS required')
    process.exit(1)
  }

  await maybeCreateFile(paths.lockFile)
  try {
    await lockfile.lock(paths.lockFile)
  } catch (err) {
    console.error('Another Station is already running on this machine.')
    console.error(`If you are sure this is not the case, please delete the lock file at "${paths.lockFile}" and try again.`)
    process.exit(1)
  }

  startPingLoop().unref()

  await Promise.all([
    saturnNode.start({
      FIL_WALLET_ADDRESS,
      MAX_DISK_SPACE,
      storagePath: join(paths.moduleCache, 'saturn-L2-node'),
      binariesPath: paths.moduleBinaries,
      metricsStream: createMetricsStream(paths.metrics),
      activityStream: createActivityStream('Saturn'),
      logStream: createLogStream(join(paths.moduleLogs, 'saturn-L2-node.log'))
    }),

    zinniaRuntime.start({
      FIL_WALLET_ADDRESS,
      STATE_ROOT: join(paths.moduleState, 'zinnia'),
      CACHE_ROOT: join(paths.moduleCache, 'zinnia'),
      moduleBinaries: paths.moduleBinaries,
      // FIXME(bajtos) We need to merge metrics reported by different modules
      metricsStream: createMetricsStream(paths.metrics.replace(/\.log$/, '-zinnia.log')),
      activityStream: createActivityStream('Runtime'),
      logStream: createLogStream(join(paths.moduleLogs, 'zinnia.log'))
    })
  ])
}
