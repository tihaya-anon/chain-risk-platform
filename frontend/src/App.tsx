import { Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/auth"
import { Layout } from "@/components/Layout"
import {
  LoginPage,
  DashboardPage,
  AddressPage,
  RiskPage,
  GraphExplorerPage,
  PathFinderPage,
  HighRiskNetworkPage,
  AdminPage,
  TagSearchPage,
} from "@/pages"
import type { ReactNode } from "react"

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Layout>{children}</Layout>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/address"
        element={
          <ProtectedRoute>
            <AddressPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/risk"
        element={
          <ProtectedRoute>
            <RiskPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/graph"
        element={
          <ProtectedRoute>
            <GraphExplorerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/path-finder"
        element={
          <ProtectedRoute>
            <PathFinderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/high-risk"
        element={
          <ProtectedRoute>
            <HighRiskNetworkPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tags"
        element={
          <ProtectedRoute>
            <TagSearchPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
