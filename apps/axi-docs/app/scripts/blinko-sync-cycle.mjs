import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig, syncNotes } from '../sync-blinko.js'
import { importMirror } from './blinko-import-mirror.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function withLock(lockPath, fn) {
  let handle

  try {
    handle = await fs.open(lockPath, 'wx')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      throw new Error(`同步已在运行中，锁文件存在：${lockPath}`)
    }
    throw error
  }

  try {
    await handle.writeFile(JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
    }, null, 2))
    return await fn()
  } finally {
    await handle.close()
    await fs.unlink(lockPath).catch(() => {})
  }
}

async function syncMirror(config = buildConfig()) {
  const lockPath = process.env.BLINKO_SYNC_LOCK_FILE
    ? path.resolve(process.env.BLINKO_SYNC_LOCK_FILE)
    : path.join(config.syncDir, '.sync.lock')

  await fs.mkdir(config.syncDir, { recursive: true })

  return withLock(lockPath, async () => {
    console.log('[sync] 开始执行 blinko 镜像同步循环')
    const importSummary = await importMirror(config)
    const exportSummary = await syncNotes(config)
    console.log('[sync] 同步循环完成')
    return { importSummary, exportSummary }
  })
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectExecution) {
  void syncMirror().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[fatal] 同步循环失败:', message)
    process.exitCode = 1
  })
}

export { syncMirror }
