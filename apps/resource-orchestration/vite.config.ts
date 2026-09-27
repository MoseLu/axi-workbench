import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Resource-orchestration workbench — hosted sub-app configuration.
 *
 * Runs as a `hosted` sub-application under Axi Workbench's
 * devsvc-dashboard host. The host injects:
 *   - AXI_APP_BASE   — public URL prefix, e.g. "/apps/resource-orchestration/"
 *   - AXI_APP_PORT   — loopback port chosen by the host
 *   - VITE_AXI_APP_BASE / VITE_AXI_HOSTED_APP / VITE_AXI_APP_ID — Vite mirrors
 *
 * The gateway service (`services/resource-gateway`) is started by the
 * same devsvc-dashboard host (registered as a separate hosted entry, see
 * `apps/devsvc-dashboard/config/axi-apps.json`). The browser calls the
 * gateway through the Vite dev-server proxy in the workbench dashboard,
 * so this Vite server only needs to point at the well-known gateway
 * loopback port (8787) when running standalone without the host.
 */
const hostedBase =
  process.env.AXI_APP_BASE ||
  process.env.VITE_AXI_APP_BASE ||
  './'
const devPort = Number(process.env.AXI_APP_PORT || process.env.PORT || 5177)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gatewayTarget = env.VITE_GATEWAY_TARGET || env.VITE_GATEWAY_BASE_URL || 'http://127.0.0.1:8787'
  const gatewayProxy: ProxyOptions = {
    target: gatewayTarget,
    changeOrigin: true,
    configure: (proxy) => {
      // Strip Origin so the gateway's same-origin bypass triggers.
      proxy.on('proxyReq', (proxyRequest) => proxyRequest.removeHeader('origin'))
    },
  }

  return {
    base: hostedBase,
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: devPort,
      strictPort: true,
      proxy: {
        '/gateway': gatewayProxy,
        '/health': gatewayProxy,
        '/routes': gatewayProxy,
        '/openapi.json': gatewayProxy,
        '/docs': gatewayProxy,
        '/metrics': gatewayProxy,
        '/memory': gatewayProxy,
        '/sessions': gatewayProxy,
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4177,
    },
  }
})
