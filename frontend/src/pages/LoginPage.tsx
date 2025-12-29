import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Button, Input } from '@/components/common'
import { authService } from '@/services'
import { useAuthStore } from '@/store/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

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
    onError: () => {
      setError('Invalid username or password')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    loginMutation.mutate({ username, password })
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
        </form>
      </div>
    </div>
  )
}
