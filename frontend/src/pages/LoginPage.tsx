import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Button, Input } from '@/components/common'
import { authService } from '@/services'
import { setMockMode, isMockMode } from '@/services/api'
import { useAuthStore } from '@/store/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [mockEnabled, setMockEnabled] = useState(isMockMode())

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: async (data) => {
      // Get user profile
      const token = data.accessToken
      // Decode JWT to get user info (simple decode, not verify)
      const payload = JSON.parse(atob(token.split('.')[1]))
      setAuth(token, {
        sub: payload.sub,
        username: payload.username,
        role: payload.role,
      })
      navigate('/')
    },
    onError: (err: Error) => {
      // If network error, enable mock mode and retry
      if (err.message.includes('Network Error') && !isMockMode()) {
        setMockMode(true)
        setMockEnabled(true)
        setError('Backend unavailable. Mock mode enabled. Try again.')
      } else {
        setError('Invalid username or password')
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    loginMutation.mutate({ username, password })
  }

  const toggleMockMode = () => {
    const newValue = !mockEnabled
    setMockMode(newValue)
    setMockEnabled(newValue)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <span className="text-6xl">🔗</span>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Chain Risk Platform
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access the dashboard
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 text-center">{error}</div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={loginMutation.isPending}
          >
            Sign in
          </Button>

          <div className="text-center text-sm text-gray-500">
            <p>Demo accounts:</p>
            <p className="font-mono">admin / admin123</p>
            <p className="font-mono">user / user123</p>
          </div>

          {/* Mock mode toggle */}
          <div className="pt-4 border-t border-gray-200">
            <label className="flex items-center justify-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mockEnabled}
                onChange={toggleMockMode}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                Mock Mode {mockEnabled && <span className="text-green-600">(Active)</span>}
              </span>
            </label>
            <p className="text-xs text-gray-400 text-center mt-1">
              Enable to use fake data when backend is unavailable
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
