import { Database, ShieldAlert, AlertTriangle, Tag, Shuffle } from "lucide-react"
import { useNavigate, Link } from "react-router-dom"
import { Card } from "@/components/common"

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
  valueColor = "text-gray-900",
  subtitle,
}: StatCardProps) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`p-3 ${iconBgColor} rounded-xl`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
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
      color: "bg-red-500",
      textColor: "text-red-600",
    },
    { label: "High", count: high, color: "bg-orange-500", textColor: "text-orange-600" },
    {
      label: "Medium",
      count: medium,
      color: "bg-yellow-500",
      textColor: "text-yellow-600",
    },
    { label: "Low", count: low, color: "bg-green-500", textColor: "text-green-600" },
  ]

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-4">
          <div className="w-20 text-sm text-gray-600">{item.label}</div>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
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
          className="w-full flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors text-left"
        >
          <Tag className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-700 truncate hover:text-indigo-600 transition-colors">
                {item.tag}
              </span>
              <span className="text-sm font-medium text-gray-900 ml-2">{item.count}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
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

  const getRiskColor = (score: number) => {
    if (score >= 0.8) return "bg-red-500"
    if (score >= 0.6) return "bg-orange-500"
    return "bg-yellow-500"
  }

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
          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${getRiskColor(alert.riskScore)}`}
          />
          <div className="flex-1 min-w-0">
            <Link
              to={`/address?q=${alert.address}`}
              className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              {alert.address}
            </Link>
            <button
              onClick={(e) => handleTagClick(e, alert.tag)}
              className="block text-xs text-gray-500 hover:text-indigo-600 transition-colors"
            >
              {alert.tag}
            </button>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-medium text-gray-900">
              {(alert.riskScore * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-gray-400">{alert.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// Export common icons
export const DashboardIcons = { Database, ShieldAlert, AlertTriangle, Shuffle }
