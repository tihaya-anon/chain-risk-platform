import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  LayoutDashboard,
  Database,
  ShieldAlert,
  Activity,
  RefreshCw,
  Network,
  Users,
  TrendingUp,
  Clock,
} from "lucide-react"
import { Card, LoadingSpinner } from "@/components/common"
import { AddressTable } from "@/components/table"
import { graphService } from "@/services"

export function DashboardPage() {
  // Fetch sync status for stats
  const syncQuery = useQuery({
    queryKey: ["syncStatus"],
    queryFn: () => graphService.getSyncStatus(),
    refetchInterval: 30000,
  })

  // Fetch high-risk addresses
  const highRiskQuery = useQuery({
    queryKey: ["dashboardHighRisk"],
    queryFn: () => graphService.getHighRiskAddresses(0.7, 10),
    refetchInterval: 60000,
  })

  const syncStatus = syncQuery.data
  const highRiskAddresses = highRiskQuery.data || []

  // Calculate risk distribution
  const riskDistribution = {
    critical: highRiskAddresses.filter((a) => a.riskScore >= 0.8).length,
    high: highRiskAddresses.filter((a) => a.riskScore >= 0.6 && a.riskScore < 0.8).length,
    medium: highRiskAddresses.filter((a) => a.riskScore >= 0.4 && a.riskScore < 0.6)
      .length,
  }

  const formatNumber = (num?: number) => {
    if (num === undefined) return "-"
    return num.toLocaleString()
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return "-"
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins} min ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "RUNNING":
        return "text-blue-600 bg-blue-100"
      case "COMPLETED":
        return "text-green-600 bg-green-100"
      case "FAILED":
        return "text-red-600 bg-red-100"
      default:
        return "text-gray-600 bg-gray-100"
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-blue-600" />
              Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Overview of on-chain risk analysis</p>
          </div>
          <button
            onClick={() => {
              syncQuery.refetch()
              highRiskQuery.refetch()
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${syncQuery.isFetching || highRiskQuery.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Total Addresses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {syncQuery.isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    formatNumber(syncStatus?.totalAddresses)
                  )}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Total Transfers</p>
                <p className="text-2xl font-bold text-purple-600">
                  {syncQuery.isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    formatNumber(syncStatus?.totalTransfers)
                  )}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Activity className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Last Synced Block</p>
                <p className="text-2xl font-bold text-orange-600">
                  {syncQuery.isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    formatNumber(syncStatus?.lastSyncedBlock)
                  )}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <ShieldAlert className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">High Risk Addresses</p>
                <p className="text-2xl font-bold text-red-600">
                  {highRiskQuery.isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    highRiskAddresses.length
                  )}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sync Status & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sync Status */}
          <Card title="Sync Status" subtitle="Data synchronization status">
            {syncQuery.isLoading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(syncStatus?.status)}`}
                  >
                    {syncStatus?.status || "UNKNOWN"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Network</span>
                  <span className="text-sm font-medium text-gray-900">
                    {syncStatus?.network || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Last Sync</span>
                  <span className="text-sm text-gray-700 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(syncStatus?.lastSyncTime)}
                  </span>
                </div>
                {syncStatus?.errorMessage && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {syncStatus.errorMessage}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Risk Distribution */}
          <Card title="Risk Distribution" subtitle="High-risk address breakdown">
            {highRiskQuery.isLoading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-red-500" />
                    <span className="text-sm text-gray-700">Critical (≥0.8)</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {riskDistribution.critical}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-orange-500" />
                    <span className="text-sm text-gray-700">High (0.6-0.8)</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {riskDistribution.high}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-yellow-500" />
                    <span className="text-sm text-gray-700">Medium (0.4-0.6)</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {riskDistribution.medium}
                  </span>
                </div>
                <Link
                  to="/high-risk"
                  className="block mt-4 text-center text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  View all high-risk addresses →
                </Link>
              </div>
            )}
          </Card>

          {/* Quick Actions */}
          <Card title="Quick Actions" subtitle="Common operations">
            <div className="space-y-3">
              <Link
                to="/graph"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <Network className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Graph Explorer</p>
                  <p className="text-xs text-gray-500">Visualize address relationships</p>
                </div>
              </Link>
              <Link
                to="/path-finder"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors"
              >
                <TrendingUp className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Path Finder</p>
                  <p className="text-xs text-gray-500">
                    Find connections between addresses
                  </p>
                </div>
              </Link>
              <Link
                to="/admin"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors"
              >
                <Users className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Admin Panel</p>
                  <p className="text-xs text-gray-500">Manage clusters and sync</p>
                </div>
              </Link>
            </div>
          </Card>
        </div>

        {/* Recent High-Risk Addresses */}
        <Card
          title="Recent High-Risk Addresses"
          subtitle="Addresses with risk score ≥ 0.7"
        >
          {highRiskQuery.isLoading ? (
            <div className="py-8 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : highRiskAddresses.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              No high-risk addresses found
            </div>
          ) : (
            <AddressTable
              addresses={highRiskAddresses.slice(0, 5)}
              showTxCount={true}
              showTags={true}
              showLastSeen={true}
              maxTagsDisplay={2}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
