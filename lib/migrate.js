import { join } from 'node:path'
import { stat, rename, mkdir } from 'node:fs/promises'
import { paths, getOldStateRoot } from './paths.js'

const exists = async path => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export const maybeMigrateRuntimeState = async () => {
  const newRuntimeStatePath = paths.runtimeState
  const oldRuntimeStatePath = join(getOldStateRoot(), 'modules')
  const hasNewState = await exists(newRuntimeStatePath)
  const hasOldState = await exists(oldRuntimeStatePath)
  if (!hasNewState && hasOldState) {
    console.error(
      `Migrating runtime state files from ${oldRuntimeStatePath} to ${newRuntimeStatePath}`
    )
    await mkdir(join(newRuntimeStatePath, '..'), { recursive: true })
    await rename(oldRuntimeStatePath, newRuntimeStatePath)
    console.error('Migration complete')
  }
}
