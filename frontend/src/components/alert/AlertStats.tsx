import { AlertTriangle, Bell, Clock, TrendingUp } from "lucide-react"
import { Card } from "@/components/common/Card"

interface AlertStats {
  total: number
  bySeverity: Record<string, number>
  byStatus: Record<string, number>
  byType: Record<string, number>
  averagePerHour: number
}

interface AlertStatsCardsProps {
  stats: AlertStats | undefined
  isLoading?: boolean
}

export function AlertStatsCards({ stats, isLoading }: AlertStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const criticalCount = stats?.bySeverity?.critical || 0
  const highCount = stats?.bySeverity?.high || 0
  const pendingCount = stats?.byStatus?.pending || 0
  const sentCount = stats?.byStatus?.sent || 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Bell}
        label="Total Alerts"
        value={stats?.total || 0}
        iconColor="text-blue-500"
        bgColor="bg-blue-100 dark:bg-blue-900/30"
      />
      <StatCard
        icon={AlertTriangle}
        label="Critical / High"
        value={`${criticalCount} / ${highCount}`}
        iconColor="text-red-500"
        bgColor="bg-red-100 dark:bg-red-900/30"
      />
      <StatCard
        icon={Clock}
        label="Pending"
        value={pendingCount + sentCount}
        iconColor="text-yellow-500"
        bgColor="bg-yellow-100 dark:bg-yellow-900/30"
      />
      <StatCard
        icon={TrendingUp}
        label="Avg/Hour"
        value={stats?.averagePerHour?.toFixed(1) || "0"}
        iconColor="text-green-500"
        bgColor="bg-green-100 dark:bg-green-900/30"
      />
    </div>
  )
}

interface StatCardProps {
  icon: typeof AlertTriangle
  label: string
  value: string | number
  iconColor: string
  bgColor: string
}

function StatCard({ icon: Icon, label, value, iconColor, bgColor }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${bgColor}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </Card>
  )
}

interface SeverityChartProps {
  bySeverity: Record<string, number>
  isLoading?: boolean
}

export function SeverityChart({ bySeverity, isLoading }: SeverityChartProps) {
  if (isLoading) {
    return (
      <Card title="Alerts by Severity">
        <div className="animate-pulse space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  const total = Object.values(bySeverity).reduce((a, b) => a + b, 0)

  const severities = [
    { key: "critical", label: "Critical", color: "bg-red-500" },
    { key: "high", label: "High", color: "bg-orange-500" },
    { key: "medium", label: "Medium", color: "bg-yellow-500" },
    { key: "low", label: "Low", color: "bg-blue-500" },
  ]

  return (
    <Card title="Alerts by Severity">
      {total === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">No alerts in the selected period</p>
      ) : (
        <div className="space-y-3">
          {severities.map(({ key, label, color }) => {
            const count = bySeverity[key] || 0
            const percent = total > 0 ? (count / total) * 100 : 0
            return (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-300">{label}</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {count} ({percent.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} transition-all duration-300`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
