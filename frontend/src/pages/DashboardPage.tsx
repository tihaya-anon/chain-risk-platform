import { LayoutDashboard, Database, ShieldAlert, Tag, Activity } from "lucide-react"
import {
  StatCard,
  RecentAlerts,
  RiskDistribution,
  DashboardIcons,
} from "@/components/dashboard"

const { CheckCircle, AlertTriangle } = DashboardIcons

// Mock data
const recentAlerts = [
  { address: "0x742d...f1b7", level: "critical" as const, time: "2 min ago" },
  { address: "0x1234...5678", level: "high" as const, time: "15 min ago" },
  { address: "0xabcd...ef01", level: "medium" as const, time: "1 hour ago" },
  { address: "0x9876...5432", level: "high" as const, time: "3 hours ago" },
]

const riskCategories = [
  { label: "Blacklisted", count: 234, color: "bg-red-500", icon: ShieldAlert },
  { label: "High Frequency", count: 567, color: "bg-orange-500", icon: Activity },
  { label: "Large Transactions", count: 890, color: "bg-yellow-500", icon: Database },
  { label: "New Addresses", count: 1234, color: "bg-blue-500", icon: Tag },
]

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
          <StatCard
            icon={Database}
            iconBgColor="bg-blue-100"
            iconColor="text-blue-600"
            label="Total Addresses"
            value="12,456"
          />
          <StatCard
            icon={CheckCircle}
            iconBgColor="bg-green-100"
            iconColor="text-green-600"
            label="Low Risk"
            value="8,234"
            valueColor="text-green-600"
          />
          <StatCard
            icon={AlertTriangle}
            iconBgColor="bg-yellow-100"
            iconColor="text-yellow-600"
            label="Medium Risk"
            value="3,156"
            valueColor="text-yellow-600"
          />
          <StatCard
            icon={ShieldAlert}
            iconBgColor="bg-red-100"
            iconColor="text-red-600"
            label="High/Critical"
            value="1,066"
            valueColor="text-red-600"
          />
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentAlerts alerts={recentAlerts} />
          <RiskDistribution categories={riskCategories} />
        </div>
      </div>
    </div>
  )
}
