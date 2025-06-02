import { execa } from 'execa'
import { installRuntime, getRuntimeExecutable } from './runtime.js'
import { updateSourceFiles } from './subnets.js'
import os from 'node:os'
import pRetry from 'p-retry'
import timers from 'node:timers/promises'
import { join } from 'node:path'

const ZINNIA_DIST_TAG = 'v0.22.2'
const SUBNETS = [
  {
    subnet: 'spark',
    ipnsKey: 'k51qzi5uqu5dlej5gtgal40sjbowuau5itwkr6mgyuxdsuhagjxtsfqjd6ym3g',
    experimental: false,
  },
]
const {
  TARGET_ARCH = os.arch(),
  SUBNET_FILTER = '',
  MODULE_FILTER, // Legacy
} = process.env

if (MODULE_FILTER) {
  console.error('MODULE_FILTER is deprecated, use SUBNET_FILTER instead')
  process.exit(1)
}

export const install = () =>
  installRuntime({
    runtime: 'zinnia',
    repo: 'CheckerNetwork/zinnia',
    distTag: ZINNIA_DIST_TAG,
    executable: 'zinniad',
    arch: TARGET_ARCH,
    targets: [
      { platform: 'darwin', arch: 'arm64', asset: 'zinniad-macos-arm64.zip' },
      { platform: 'darwin', arch: 'x64', asset: 'zinniad-macos-x64.zip' },
      { platform: 'linux', arch: 'arm64', asset: 'zinniad-linux-arm64.tar.gz' },
      { platform: 'linux', arch: 'x64', asset: 'zinniad-linux-x64.tar.gz' },
      { platform: 'win32', arch: 'x64', asset: 'zinniad-windows-x64.zip' },
    ],
  })

const matchesSubnetFilter = (subnet) =>
  SUBNET_FILTER === '' || subnet === SUBNET_FILTER

const capitalize = (str) => `${str.charAt(0).toUpperCase()}${str.slice(1)}`

const updateAllSourceFiles = async ({
  subnetVersionsDir,
  subnetSourcesDir,
  signal,
}) => {
  const subnets = await Promise.all(
    Object.values(SUBNETS)
      .filter(({ subnet }) => matchesSubnetFilter(subnet))
      .map(({ subnet, ipnsKey }) =>
        pRetry(
          (attemptNumber) =>
            updateSourceFiles({
              subnet,
              ipnsKey,
              subnetVersionsDir,
              subnetSourcesDir,
              noCache: attemptNumber > 1,
            }),
          {
            signal,
            retries: 10,
            onFailedAttempt: (err) => {
              console.error(err)
              const msg = `Failed to download ${subnet} source. Retrying...`
              console.error(msg)
              if (String(err).includes('You are being rate limited')) {
                const delaySeconds = 60 + Math.random() * 60
                // Don't DDOS the w3name services
                console.error(
                  `Rate limited. Waiting ${delaySeconds} seconds...`,
                )
                return timers.setTimeout(delaySeconds * 1000)
              }
            },
          },
        ),
      ),
  )
  const hasUpdated = subnets.find((updated) => updated === true)
  return hasUpdated
}

const runUpdateSourceFilesLoop = async ({
  controller,
  signal,
  onActivity,
  subnetVersionsDir,
  subnetSourcesDir,
}) => {
  while (true) {
    if (signal.aborted) {
      return
    }
    const delay = 10 * 60 * 1000 // 10 minutes
    const jitter = Math.random() * 20_000 - 10_000 // +- 10 seconds
    try {
      await timers.setTimeout(delay + jitter, null, { signal })
    } catch (err) {
      if (err.name === 'AbortError') return
      throw err
    }
    try {
      const shouldRestart = await updateAllSourceFiles({
        subnetVersionsDir,
        subnetSourcesDir,
        signal,
      })
      if (shouldRestart) {
        onActivity({
          type: 'info',
          message: 'Updated subnet source code, restarting...',
        })
        controller.abort()
        return
      }
    } catch (err) {
      onActivity({
        type: 'error',
        message: 'Failed to update subnet source code',
      })
      console.error(err)
    }
  }
}

const catchChildProcessExit = async ({
  childProcesses,
  controller,
  onActivity,
}) => {
  try {
    const tasks = childProcesses.map((p) =>
      (async () => {
        try {
          await p
          onActivity({
            type: 'info',
            message: `${capitalize(p.subnetName)} exited`,
          })
        } catch (err) {
          // When the child process crash, attach the subnet name & the exit reason to the error object
          const exitReason = p.exitCode
            ? `with exit code ${p.exitCode}`
            : p.signalCode
              ? `via signal ${p.signalCode}`
              : undefined
          throw Object.assign(err, {
            subnetName: p.subnetName,
            exitReason,
            signalCode: p.signalCode,
          })
        }
      })(),
    )

    await Promise.race(tasks)
  } catch (err) {
    if (err.name !== 'AbortError') {
      const subnetName = capitalize(err.subnetName ?? 'Zinnia')
      const exitReason = err.exitReason ?? 'for unknown reason'
      const message = `${subnetName} crashed ${exitReason}`
      onActivity({ type: 'error', message })

      const subnetErr = new Error(message, { cause: err })
      // Store the full error message including stdout & stder in the top-level `details` property
      Object.assign(subnetErr, { details: err.message })

      if (
        err.signalCode &&
        ['SIGTERM', 'SIGKILL', 'SIGINT'].includes(err.signalCode)
      ) {
        // These signal codes are triggered when somebody terminates the process from outside.
        // It's not a problem in Zinnia, there is nothing we can do about this.
        // Don't print the stack trace to stderr,
        // treat this as a regular exit (successful completion of the process).
        // (Note that this event has been already logged via `onActivity()` call above.)
        return
      }
    }
    throw err
  } finally {
    controller.abort()
  }
}

export async function run({
  provider,
  CHECKER_ID,
  FIL_WALLET_ADDRESS,
  ethAddress,
  STATE_ROOT,
  CACHE_ROOT,
  subnetVersionsDir,
  subnetSourcesDir,
  onActivity,
  onMetrics,
  isUpdated = false,
  experimental = false,
}) {
  const zinniadExe = getRuntimeExecutable({
    runtime: 'zinnia',
    executable: 'zinniad',
  })

  if (!isUpdated) {
    try {
      onActivity({
        type: 'info',
        message: 'Updating source code for subnets...',
      })
      await updateAllSourceFiles({
        subnetVersionsDir,
        subnetSourcesDir,
        signal: null,
      })
      onActivity({
        type: 'info',
        message: 'Subnet source code up to date',
      })
    } catch (err) {
      onActivity({
        type: 'error',
        message: 'Failed to download latest Subnet source code',
      })
      throw err
    }
  }

  const controller = new AbortController()
  const { signal } = controller
  const childProcesses = []

  for (const { subnet, experimental: subnetIsExperimental } of SUBNETS) {
    const skipExperimentalSubnet = !experimental && subnetIsExperimental
    if (!matchesSubnetFilter(subnet) || skipExperimentalSubnet) continue

    // all paths are relative to `runtimeBinaries`
    const childProcess = execa(zinniadExe, [join(subnet, 'main.js')], {
      cwd: subnetSourcesDir,
      env: {
        STATION_ID: CHECKER_ID,
        FIL_WALLET_ADDRESS,
        STATE_ROOT,
        CACHE_ROOT,
      },
      cancelSignal: signal,
    })
    childProcesses.push(Object.assign(childProcess, { subnetName: subnet }))

    let timeoutId
    const resetTimeout = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(
        () => {
          onActivity({
            type: 'error',
            message: `${capitalize(subnet)} has been inactive for 5 minutes, restarting...`,
          })

          controller.abort()
        },
        5 * 60 * 1000,
      )
    }
    resetTimeout()
    signal.addEventListener('abort', () => clearTimeout(timeoutId))

    childProcess.stdout.setEncoding('utf-8')
    childProcess.stdout.on('data', (data) => {
      resetTimeout()
      handleEvents({
        subnet,
        onActivity,
        onMetrics,
        text: data,
      }).catch((err) => {
        console.error(err)
      })
    })
    childProcess.stderr.setEncoding('utf-8')
    childProcess.stderr.on('data', (data) => {
      resetTimeout()
      process.stderr.write(data)
    })
  }

  try {
    await Promise.all([
      runUpdateSourceFilesLoop({
        controller,
        signal,
        onActivity,
        subnetVersionsDir,
        subnetSourcesDir,
      }),
      catchChildProcessExit({ childProcesses, onActivity, controller }),
    ])
    console.error('Zinnia main loop ended')
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('Zinnia main loop aborted')
    } else {
      console.error('Zinnia main loop errored', err)
    }
  } finally {
    controller.abort()
  }

  // This infinite recursion has no risk of exceeding the maximum call stack
  // size, as awaiting promises unwinds the stack
  return run({
    provider,
    CHECKER_ID,
    FIL_WALLET_ADDRESS,
    ethAddress,
    STATE_ROOT,
    CACHE_ROOT,
    subnetVersionsDir,
    subnetSourcesDir,
    onActivity,
    onMetrics,
    isUpdated: true,
    experimental,
  })
}

const jobsCompleted = {}

async function handleEvents({ subnet, onActivity, onMetrics, text }) {
  for (const line of text.trimEnd().split(/\n/g)) {
    let event
    try {
      event = JSON.parse(line)
    } catch (err) {
      console.error('Ignoring malformed Zinnia event:', line)
    }

    try {
      switch (event.type) {
        case 'activity:started':
          onActivity({
            type: 'info',
            message: `${capitalize(subnet)} started`,
            source: subnet,
          })
          break
        case 'activity:info':
          onActivity({
            type: 'info',
            message: event.message.replace(
              /Module Runtime/,
              capitalize(subnet),
            ),
            source: event.subnet,
          })
          break

        case 'activity:error':
          onActivity({
            type: 'error',
            message: event.message.replace(
              /Module Runtime/,
              capitalize(subnet),
            ),
            source: event.subnet,
          })
          break

        case 'jobs-completed': {
          jobsCompleted[subnet] = event.total
          const totalJobsCompleted = Object.values(jobsCompleted).reduce(
            (a, b) => a + b,
            0,
          )
          onMetrics({ totalJobsCompleted })
          break
        }

        default:
          console.error('Ignoring Zinnia event of unknown type:', event)
      }
    } catch (err) {
      console.error('Cannot handle Zinnia event: %s', line)
      console.error(err)
    }
  }
}
