import api, { isMockMode } from './api'
import { mockLogin, mockGetProfile } from './mock'
import type { LoginRequest, LoginResponse, User } from '@/types'

export const authService = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    try {
      const response = await api.post<LoginResponse>('/auth/login', data)
      return response.data
    } catch (error) {
      if (isMockMode()) {
        console.log('[Mock] authService.login')
        return mockLogin()
      }
      throw error
    }
  },

  getProfile: async (): Promise<User> => {
    try {
      const response = await api.get<User>('/auth/profile')
      return response.data
    } catch (error) {
      if (isMockMode()) {
        console.log('[Mock] authService.getProfile')
        return mockGetProfile()
      }
      throw error
    }
  },
}
