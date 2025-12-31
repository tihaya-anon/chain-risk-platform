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

// Stats Card Component
interface StatCardProps {
  icon: React.ElementType
  iconBgColor: string
  iconColor: string
  label: string
  value: string | number
  valueColor?: string
}

export function StatCard({
  icon: Icon,
  iconBgColor,
  iconColor,
  label,
  value,
  valueColor = "text-gray-900",
}: StatCardProps) {
  return (
    <Card className="!p-6">
      <div className="flex items-center">
        <div className={`p-3 ${iconBgColor} rounded-lg`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div className="ml-4">
          <p className="text-sm text-gray-500">{label}</p>
          <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
        </div>
      </div>
    </Card>
  )
}

// Recent Alerts Component
interface Alert {
  address: string
  level: "critical" | "high" | "medium"
  time: string
}

export function RecentAlerts({ alerts }: { alerts: Alert[] }) {
  const getLevelColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-500"
      case "high":
        return "bg-orange-500"
      default:
        return "bg-yellow-500"
    }
  }

  return (
    <Card title="Recent Risk Alerts" subtitle="Last 24 hours">
      <div className="space-y-4">
        {alerts.map((alert, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
          >
            <div className="flex items-center space-x-3">
              <span className={`w-2 h-2 rounded-full ${getLevelColor(alert.level)}`} />
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
  )
}

// Risk Distribution Component
interface RiskCategory {
  label: string
  count: number
  color: string
  icon: React.ElementType
}

export function RiskDistribution({ categories }: { categories: RiskCategory[] }) {
  return (
    <Card title="Risk Distribution" subtitle="By category">
      <div className="space-y-4">
        {categories.map((item, i) => {
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
  )
}

// Export icons for use in page
export const DashboardIcons = {
  LayoutDashboard,
  Database,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Tag,
  Activity,
}
