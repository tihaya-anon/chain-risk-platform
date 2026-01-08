import { Database, ShieldAlert, AlertTriangle, Tag, Shuffle } from "lucide-react"
import { useNavigate, Link } from "react-router-dom"
import { Card } from "@/components/common"
import { RISK_COLORS, getRiskDotClass } from "@/lib/palette"

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

// Recent Alerts
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

// Export common icons
export const DashboardIcons = { Database, ShieldAlert, AlertTriangle, Shuffle }
