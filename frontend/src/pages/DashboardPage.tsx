import { Link } from "react-router-dom"
import {
  LayoutDashboard,
  RefreshCw,
  Network,
  Search,
  Route,
  Tag,
  Bell,
  Database,
  Shuffle,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
} from "lucide-react"
import { Card, LoadingSpinner } from "@/components/common"
import { AddressTable } from "@/components/table"
import {
  useGraphControllerGetHighRiskAddresses,
  useGetPipelineStatus,
  useAlertControllerGetStats,
  useAlertControllerListHistory,
  type AlertHistoryResponse,
} from "@/api/generated"
import type { GraphAddressInfo } from "@/api/generated"
import { formatDistanceToNow } from "date-fns"

export function DashboardPage() {
  const highRiskQuery = useGraphControllerGetHighRiskAddresses(
    { threshold: 0.7, limit: 10 },
    { query: { refetchInterval: 60000 } }
  )
  const pipelineQuery = useGetPipelineStatus({ query: { refetchInterval: 30000 } })
  const alertStatsQuery = useAlertControllerGetStats({ hours: 24 })
  const recentAlertsQuery = useAlertControllerListHistory({ pageSize: 5, page: 1 })

  const highRiskAddresses: GraphAddressInfo[] = highRiskQuery.data || []
  const pipelineStatus = pipelineQuery.data
  const alertStats = alertStatsQuery.data
  const recentAlerts = recentAlertsQuery.data?.data || []

  const isRefreshing =
    highRiskQuery.isFetching || pipelineQuery.isFetching || alertStatsQuery.isFetching

  const handleRefresh = () => {
    highRiskQuery.refetch()
    pipelineQuery.refetch()
    alertStatsQuery.refetch()
    recentAlertsQuery.refetch()
  }

  // Stats
  const lastBlock = pipelineStatus?.ingestion?.lastBlock?.toLocaleString() || "-"
  const processedCount = pipelineStatus?.streamProcessor?.processedCount?.toLocaleString() || "-"
  const bySeverity = alertStats?.bySeverity as Record<string, number> | undefined
  const byStatus = alertStats?.byStatus as Record<string, number> | undefined
  const criticalAlerts = bySeverity?.critical || 0
  const highAlerts = bySeverity?.high || 0
  const pendingAlerts = (byStatus?.pending || 0) + (byStatus?.sent || 0)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <LayoutDashboard className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              Dashboard
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Real-time on-chain risk monitoring
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Database}
            iconColor="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-100 dark:bg-blue-900/50"
            label="Last Block"
            value={lastBlock}
          />
          <StatCard
            icon={Shuffle}
            iconColor="text-purple-600 dark:text-purple-400"
            bgColor="bg-purple-100 dark:bg-purple-900/50"
            label="Processed TXs"
            value={processedCount}
          />
          <StatCard
            icon={ShieldAlert}
            iconColor="text-red-600 dark:text-red-400"
            bgColor="bg-red-100 dark:bg-red-900/50"
            label="High Risk"
            value={highRiskAddresses.length}
            valueColor="text-red-600 dark:text-red-400"
          />
          <StatCard
            icon={Bell}
            iconColor="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-100 dark:bg-orange-900/50"
            label="Pending Alerts"
            value={pendingAlerts}
            valueColor={pendingAlerts > 0 ? "text-orange-600 dark:text-orange-400" : undefined}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Alerts */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Alerts
                </h3>
              </div>
              <Link
                to="/alerts"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {recentAlertsQuery.isLoading ? (
              <LoadingSpinner />
            ) : recentAlerts.length > 0 ? (
              <div className="space-y-3">
                {recentAlerts.map((alert: AlertHistoryResponse) => (
                  <div
                    key={alert.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <SeverityDot severity={alert.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {alert.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        alert.severity === "critical"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                          : alert.severity === "high"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent alerts</p>
            )}
          </Card>

          {/* Alert Summary + Quick Links */}
          <div className="space-y-6">
            {/* Alert Summary */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Alert Summary (24h)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {criticalAlerts}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Critical</p>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {highAlerts}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">High</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total (24h)</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {alertStats?.total || 0}
                  </span>
                </div>
              </div>
            </Card>

            {/* Quick Links */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Quick Access
              </h3>
              <div className="space-y-2">
                <QuickLink to="/address" icon={Search} label="Address Analysis" />
                <QuickLink to="/alerts" icon={Bell} label="Alert Management" />
                <QuickLink to="/graph" icon={Network} label="Graph Explorer" />
                <QuickLink to="/path-finder" icon={Route} label="Path Finder" />
                <QuickLink to="/tags" icon={Tag} label="Tag Search" />
              </div>
            </Card>
          </div>
        </div>

        {/* High Risk Table */}
        <Card title="High-Risk Addresses" subtitle="Addresses with risk score ≥ 0.7">
          {highRiskQuery.isLoading ? (
            <div className="py-12">
              <LoadingSpinner />
            </div>
          ) : highRiskAddresses.length > 0 ? (
            <AddressTable
              addresses={highRiskAddresses}
              showTxCount
              showInOut
              showTags
              maxTagsDisplay={2}
            />
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No high-risk addresses found
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// Helper Components
function StatCard({
  icon: Icon,
  iconColor,
  bgColor,
  label,
  value,
  valueColor,
}: {
  icon: typeof Database
  iconColor: string
  bgColor: string
  label: string
  value: string | number
  valueColor?: string
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 ${bgColor} rounded-lg`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-xl font-bold ${valueColor || "text-gray-900 dark:text-white"}`}>
            {value}
          </p>
        </div>
      </div>
    </Card>
  )
}

function QuickLink({
  to,
  icon: Icon,
  label,
}: {
  to: string
  icon: typeof Search
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      <Icon className="w-4 h-4 text-gray-400" />
      <span className="text-sm">{label}</span>
    </Link>
  )
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-blue-500",
  }
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[severity] || colors.low}`} />
}
