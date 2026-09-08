import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import {
  isWorkbenchRoot,
  parseArgs,
  probeHealth,
  repoRoot,
  SERVICES,
} from './ensure-local-runtime.mjs'

test('parseArgs defaults to supervise unless --wait is set', () => {
  assert.deepEqual(parseArgs([]), { wait: false, supervise: true, skipDocker: false })
  assert.deepEqual(parseArgs(['--wait']), { wait: true, supervise: false, skipDocker: false })
  assert.deepEqual(parseArgs(['--supervise', '--skip-docker']), {
    wait: false,
    supervise: true,
    skipDocker: true,
  })
})

test('isWorkbenchRoot accepts the current repo', () => {
  assert.equal(isWorkbenchRoot(repoRoot), true)
  assert.equal(isWorkbenchRoot(repoRoot + '/apps/workbench-desktop'), false)
})

test('SERVICES keep gateway last so control-plane is ready first', () => {
  assert.equal(SERVICES.at(-1).name, 'api-gateway')
  assert.equal(SERVICES[0].name, 'control-plane')
})

test('probeHealth returns true only for HTTP 2xx', async () => {
  const server = createServer((request, response) => {
    response.statusCode = request.url === '/health' ? 200 : 500
    response.end('ok')
  })
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  const { port } = server.address()
  try {
    assert.equal(await probeHealth(`http://127.0.0.1:${port}/health`), true)
    assert.equal(await probeHealth(`http://127.0.0.1:${port}/down`), false)
    assert.equal(await probeHealth(`http://127.0.0.1:${port + 1}/health`, 200), false)
  } finally {
    server.close()
  }
})
