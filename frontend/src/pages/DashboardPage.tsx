import {
  LayoutDashboard,
  Database,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Tag,
  Activity,
} from "lucide-react"
import { Card } from "@/components/common"

export function DashboardPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-blue-600" />
            Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Overview of on-chain risk analysis</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="!p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Total Addresses</p>
                <p className="text-2xl font-bold text-gray-900">12,456</p>
              </div>
            </div>
          </Card>

          <Card className="!p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Low Risk</p>
                <p className="text-2xl font-bold text-green-600">8,234</p>
              </div>
            </div>
          </Card>

          <Card className="!p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Medium Risk</p>
                <p className="text-2xl font-bold text-yellow-600">3,156</p>
              </div>
            </div>
          </Card>

          <Card className="!p-6">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <ShieldAlert className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">High/Critical</p>
                <p className="text-2xl font-bold text-red-600">1,066</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Recent Risk Alerts" subtitle="Last 24 hours">
            <div className="space-y-4">
              {[
                { address: "0x742d...f1b7", level: "critical", time: "2 min ago" },
                { address: "0x1234...5678", level: "high", time: "15 min ago" },
                { address: "0xabcd...ef01", level: "medium", time: "1 hour ago" },
                { address: "0x9876...5432", level: "high", time: "3 hours ago" },
              ].map((alert, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        alert.level === "critical"
                          ? "bg-red-500"
                          : alert.level === "high"
                            ? "bg-orange-500"
                            : "bg-yellow-500"
                      }`}
                    />
                    <span className="font-mono text-sm">{alert.address}</span>
                  </div>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {alert.time}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Risk Distribution" subtitle="By category">
            <div className="space-y-4">
              {[
                {
                  label: "Blacklisted",
                  count: 234,
                  color: "bg-red-500",
                  icon: ShieldAlert,
                },
                {
                  label: "High Frequency",
                  count: 567,
                  color: "bg-orange-500",
                  icon: Activity,
                },
                {
                  label: "Large Transactions",
                  count: 890,
                  color: "bg-yellow-500",
                  icon: Database,
                },
                {
                  label: "New Addresses",
                  count: 1234,
                  color: "bg-blue-500",
                  icon: Tag,
                },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`w-3 h-3 rounded ${item.color}`} />
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
