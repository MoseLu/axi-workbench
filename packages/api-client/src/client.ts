import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios"
import type { ApiResponse } from "@epap/types"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"

export const createApiClient = (config?: AxiosRequestConfig): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
    },
    ...config,
  })

  // Request interceptor
  client.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("accessToken")
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error) => Promise.reject(error)
  )

  // Response interceptor
  client.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => response,
    async (error) => {
      const originalRequest = error.config

      // Handle 401 - Token refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true

        try {
          const refreshToken = localStorage.getItem("refreshToken")
          if (refreshToken) {
            const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
              refreshToken,
            })
            const { accessToken } = response.data.data
            localStorage.setItem("accessToken", accessToken)
            
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`
            }
            return client(originalRequest)
          }
        } catch (refreshError) {
          localStorage.removeItem("accessToken")
          localStorage.removeItem("refreshToken")
          window.location.href = "/login"
          return Promise.reject(refreshError)
        }
      }

      return Promise.reject(error)
    }
  )

  return client
}

export const apiClient = createApiClient()
