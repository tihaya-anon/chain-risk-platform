import { Database, ShieldAlert, AlertTriangle, Tag, Shuffle, Bell, ArrowRight } from "lucide-react"
import { useNavigate, Link } from "react-router-dom"
import { Card, LoadingSpinner } from "@/components/common"
import { RISK_COLORS, getRiskDotClass } from "@/lib/palette"
import { useGetAlertStats } from "@/api/generated"

// Stat Card
interface StatCardProps {
  icon: React.ElementType
  iconBgColor: string
  iconColor: string
  label: string
  value: string | number
  valueColor?: string
  subtitle?: string
}

export function StatCard({
  icon: Icon,
  iconBgColor,
  iconColor,
  label,
  value,
  valueColor = "text-gray-900 dark:text-white",
  subtitle,
}: StatCardProps) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`p-3 ${iconBgColor} rounded-xl`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </Card>
  )
}

// Risk Distribution Bar Chart
interface RiskDistributionProps {
  critical: number
  high: number
  medium: number
  low: number
}

export function RiskDistributionChart({
  critical,
  high,
  medium,
  low,
}: RiskDistributionProps) {
  const total = critical + high + medium + low || 1
  const items = [
    {
      label: "Critical",
      count: critical,
      color: RISK_COLORS.critical.bgSolid,
      textColor: RISK_COLORS.critical.text,
    },
    {
      label: "High",
      count: high,
      color: RISK_COLORS.high.bgSolid,
      textColor: RISK_COLORS.high.text,
    },
    {
      label: "Medium",
      count: medium,
      color: RISK_COLORS.medium.bgSolid,
      textColor: RISK_COLORS.medium.text,
    },
    {
      label: "Low",
      count: low,
      color: RISK_COLORS.low.bgSolid,
      textColor: RISK_COLORS.low.text,
    },
  ]

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-4">
          <div className="w-20 text-sm text-gray-600 dark:text-gray-400">{item.label}</div>
          <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${item.color} rounded-full transition-all duration-500`}
              style={{ width: `${(item.count / total) * 100}%` }}
            />
          </div>
          <div className={`w-16 text-sm font-semibold text-right ${item.textColor}`}>
            {item.count.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}

// Tag Distribution
interface TagCount {
  tag: string
  count: number
}

export function TagDistribution({ tags }: { tags: TagCount[] }) {
  const navigate = useNavigate()
  const maxCount = Math.max(...tags.map((t) => t.count), 1)

  const handleTagClick = (tag: string) => {
    navigate(`/tags?q=${encodeURIComponent(tag)}`)
  }

  return (
    <div className="space-y-3">
      {tags.slice(0, 6).map((item) => (
        <button
          key={item.tag}
          onClick={() => handleTagClick(item.tag)}
          className="w-full flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-1 -m-1 transition-colors text-left"
        >
          <Tag className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                {item.tag}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white ml-2">
                {item.count}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

// Recent Alerts (from high-risk addresses)
interface Alert {
  address: string
  riskScore: number
  tag: string
  time: string
}

export function RecentAlerts({ alerts }: { alerts: Alert[] }) {
  const navigate = useNavigate()

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.preventDefault()
    e.stopPropagation()
    navigate(`/tags?q=${encodeURIComponent(tag)}`)
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${getRiskDotClass(alert.riskScore)}`}
          />
          <div className="flex-1 min-w-0">
            <Link
              to={`/address?q=${alert.address}`}
              className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
            >
              {alert.address}
            </Link>
            <button
              onClick={(e) => handleTagClick(e, alert.tag)}
              className="block text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {alert.tag}
            </button>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {(alert.riskScore * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{alert.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// Alert Summary Widget - Real-time alert statistics
export function AlertSummaryWidget() {
  const { data: stats, isLoading } = useGetAlertStats(24)

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Alert Summary
            </h3>
          </div>
        </div>
        <div className="py-8">
          <LoadingSpinner />
        </div>
      </Card>
    )
  }

  const critical = stats?.bySeverity?.critical || 0
  const high = stats?.bySeverity?.high || 0
  const pending = stats?.byStatus?.pending || 0
  const sent = stats?.byStatus?.sent || 0
  const total = stats?.total || 0

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Alert Summary
          </h3>
        </div>
        <Link
          to="/alerts"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
        >
          View All
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total (24h)</p>
          </div>
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {pending + sent}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Unresolved</p>
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">By Severity</p>
          <div className="flex gap-2">
            <SeverityPill label="Critical" count={critical} color="red" />
            <SeverityPill label="High" count={high} color="orange" />
            <SeverityPill label="Med" count={stats?.bySeverity?.medium || 0} color="yellow" />
            <SeverityPill label="Low" count={stats?.bySeverity?.low || 0} color="blue" />
          </div>
        </div>

        {/* Rate */}
        {stats?.averagePerHour !== undefined && stats.averagePerHour > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Average rate:{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {stats.averagePerHour.toFixed(1)}/hour
              </span>
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

function SeverityPill({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: "red" | "orange" | "yellow" | "blue"
}) {
  const colorMap = {
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  }

  return (
    <div className={`flex-1 px-2 py-1.5 rounded-lg text-center ${colorMap[color]}`}>
      <p className="text-lg font-bold">{count}</p>
      <p className="text-xs">{label}</p>
    </div>
  )
}

// Export common icons
export const DashboardIcons = { Database, ShieldAlert, AlertTriangle, Shuffle }
