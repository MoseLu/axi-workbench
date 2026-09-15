import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  isWorkbenchRoot,
  loadProjectEnv,
  parseArgs,
  probeHealth,
  repoRoot,
  resolveLocalTlsConfig,
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
  assert.equal(SERVICES.at(-2).name, 'api-gateway')
  assert.equal(SERVICES.at(-1).name, 'local-https')
  assert.equal(SERVICES[0].name, 'control-plane')
})

test('loads missing values from the project .env without overwriting the process', () => {
  const root = mkdtempSync(join(tmpdir(), 'axi-workbench-env-'))
  const existing = process.env.AXI_RUNTIME_EXISTING
  process.env.AXI_RUNTIME_EXISTING = 'process-value'
  writeFileSync(join(root, '.env'), 'AXI_RUNTIME_EXISTING=file-value\nAXI_RUNTIME_FROM_FILE="quoted value"\n')
  try {
    assert.equal(loadProjectEnv(root), true)
    assert.equal(process.env.AXI_RUNTIME_EXISTING, 'process-value')
    assert.equal(process.env.AXI_RUNTIME_FROM_FILE, 'quoted value')
  } finally {
    if (existing === undefined) delete process.env.AXI_RUNTIME_EXISTING
    else process.env.AXI_RUNTIME_EXISTING = existing
    delete process.env.AXI_RUNTIME_FROM_FILE
    rmSync(root, { recursive: true, force: true })
  }
})

test('resolves local TLS paths relative to the project root', () => {
  const root = mkdtempSync(join(tmpdir(), 'axi-workbench-tls-'))
  const previous = {
    cert: process.env.WORKBENCH_TLS_CERT_FILE,
    key: process.env.WORKBENCH_TLS_KEY_FILE,
    host: process.env.WORKBENCH_HTTPS_HOST,
    port: process.env.WORKBENCH_HTTPS_PORT,
  }
  writeFileSync(join(root, 'cert.pem'), 'certificate')
  writeFileSync(join(root, 'key.pem'), 'private key')
  process.env.WORKBENCH_TLS_CERT_FILE = 'cert.pem'
  process.env.WORKBENCH_TLS_KEY_FILE = 'key.pem'
  delete process.env.WORKBENCH_HTTPS_HOST
  delete process.env.WORKBENCH_HTTPS_PORT
  try {
    assert.deepEqual(resolveLocalTlsConfig(root), {
      certPath: join(root, 'cert.pem'),
      keyPath: join(root, 'key.pem'),
    })
    assert.equal(process.env.WORKBENCH_HTTPS_PORT, '8443')
    assert.equal(process.env.WORKBENCH_LOCAL_GATEWAY_ORIGIN, 'http://127.0.0.1:8088')
  } finally {
    const restore = (key, value) => {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    restore('WORKBENCH_TLS_CERT_FILE', previous.cert)
    restore('WORKBENCH_TLS_KEY_FILE', previous.key)
    restore('WORKBENCH_HTTPS_HOST', previous.host)
    restore('WORKBENCH_HTTPS_PORT', previous.port)
    delete process.env.WORKBENCH_LOCAL_GATEWAY_ORIGIN
    delete process.env.WORKBENCH_LOCAL_CONTROL_PLANE_ORIGIN
    rmSync(root, { recursive: true, force: true })
  }
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
