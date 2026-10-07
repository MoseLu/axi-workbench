import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios"

// @axi/types 未在 api-client 的 workspace 依赖中声明（tsconfig 也无法解析到它），
// 这里内联与 packages/types/src/api.ts 一致的 ApiResponse 结构，避免引入新依赖。
interface ApiResponse<T = unknown> {
  code: number
  message: string
  data?: T
}

const metaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {}
// Browser applications use a relative /api path in development and an explicit
// HTTPS gateway origin in production. No browser-side access or refresh token
// is used.
const API_BASE_URL = metaEnv.VITE_API_BASE_URL || ""
// Browser consumers must reach the control plane through the authenticated
// Gateway. Directly exposing localhost:8092 would bypass the session boundary
// and makes cookie/CORS behavior dependent on the user's browser.
const CONTROL_PLANE_BASE_URL = metaEnv.VITE_CONTROL_PLANE_BASE_URL || "/api/v1/control-plane"

export const createApiClient = (config?: AxiosRequestConfig): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    withCredentials: true,
    // Packaged Tauri uses the window.fetch bridge to route /api requests
    // through the authenticated native Gateway. Axios' default XHR adapter
    // bypasses that bridge and leaves snapshot-backed pages empty.
    adapter: 'fetch',
    headers: {
      "Content-Type": "application/json",
    },
    ...config,
  })

  // A 401 represents a missing or expired HttpOnly gateway session. The OIDC
  // redirect is initiated explicitly by the application rather than attempting
  // to refresh a token from localStorage.
  client.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => response,
    (error) => Promise.reject(error)
  )

  return client
}

export const apiClient = createApiClient()

export const controlPlaneClient = createApiClient({
  baseURL: CONTROL_PLANE_BASE_URL,
  withCredentials: true,
})
