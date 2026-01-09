import { AlertTriangle, Bell, Clock, TrendingUp } from "lucide-react"
import { Card } from "@/components/common/Card"
import { SEVERITY_COLORS, type SeverityLevel } from "@/lib/palette"

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
        level="info"
      />
      <StatCard
        icon={AlertTriangle}
        label="Critical / High"
        value={`${criticalCount} / ${highCount}`}
        level="critical"
      />
      <StatCard
        icon={Clock}
        label="Pending"
        value={pendingCount + sentCount}
        level="medium"
      />
      <StatCard
        icon={TrendingUp}
        label="Avg/Hour"
        value={stats?.averagePerHour?.toFixed(1) || "0"}
        level="low"
      />
    </div>
  )
}

interface StatCardProps {
  icon: typeof AlertTriangle
  label: string
  value: string | number
  level: SeverityLevel
}

function StatCard({ icon: Icon, label, value, level }: StatCardProps) {
  const colors = SEVERITY_COLORS[level]
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colors.bg}`}>
          <Icon className={`w-6 h-6 ${colors.text}`} />
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

  const severities: { key: string; label: string; level: SeverityLevel }[] = [
    { key: "critical", label: "Critical", level: "critical" },
    { key: "high", label: "High", level: "high" },
    { key: "medium", label: "Medium", level: "medium" },
    { key: "low", label: "Low", level: "low" },
  ]

  return (
    <Card title="Alerts by Severity">
      {total === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">No alerts in the selected period</p>
      ) : (
        <div className="space-y-3">
          {severities.map(({ key, label, level }) => {
            const count = bySeverity[key] || 0
            const percent = total > 0 ? (count / total) * 100 : 0
            return (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-300">{label}</span>
                  <span className="text-gray-900 dark:text-white font-medium mr-1">{count}</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${SEVERITY_COLORS[level].bgSolid} transition-all duration-300`}
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
