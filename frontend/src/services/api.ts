import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/auth'

// Check if mock mode is enabled (backend unavailable)
let useMockMode = false

export const setMockMode = (enabled: boolean) => {
  useMockMode = enabled
  console.log(`[API] Mock mode ${enabled ? 'enabled' : 'disabled'}`)
}

export const isMockMode = () => useMockMode

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors and detect backend unavailability
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Check if backend is unavailable (network error or timeout)
    if (
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.message.includes('Network Error')
    ) {
      // Enable mock mode automatically
      if (!useMockMode) {
        setMockMode(true)
        console.warn('[API] Backend unavailable, switching to mock mode')
      }
    }

    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
