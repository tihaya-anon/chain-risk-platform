import { Link, useLocation, useNavigate } from "react-router-dom"
import { clsx } from "clsx"
import {
  LayoutDashboard,
  Search,
  Network,
  Route,
  AlertTriangle,
  ShieldAlert,
  Link2,
  LogOut,
  User,
  Settings,
  Tag,
} from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { Button } from "@/components/common"
import type { ReactNode, ElementType } from "react"

interface LayoutProps {
  children: ReactNode
}

interface NavItem {
  path: string
  label: string
  icon: ElementType
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/address", label: "Address", icon: Search },
  { path: "/graph", label: "Graph", icon: Network },
  { path: "/path-finder", label: "Path Finder", icon: Route },
  { path: "/tags", label: "Tags", icon: Tag },
  { path: "/risk", label: "Risk", icon: AlertTriangle },
  { path: "/high-risk", label: "High Risk", icon: ShieldAlert },
  { path: "/admin", label: "Admin", icon: Settings, adminOnly: true },
]

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  )

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <Link2 className="w-6 h-6 text-blue-600" />
                <span className="font-bold text-xl text-gray-900">Chain Risk</span>
              </Link>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      location.pathname === item.path
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* User menu */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>{user?.username}</span>
                <span
                  className={clsx(
                    "text-xs px-1.5 py-0.5 rounded",
                    user?.role === "admin"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  {user?.role}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-gray-200 px-4 py-2 overflow-x-auto">
          <nav className="flex space-x-2">
            {visibleNavItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    "flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    location.pathname === item.path
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Main content - Scrollable */}
      <main className="flex-1 overflow-hidden bg-gray-50">{children}</main>

      {/* Footer - Fixed */}
      <footer className="flex-shrink-0 bg-white border-t border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <p className="text-center text-sm text-gray-500">Chain Risk Platform © 2024</p>
        </div>
      </footer>
    </div>
  )
}
