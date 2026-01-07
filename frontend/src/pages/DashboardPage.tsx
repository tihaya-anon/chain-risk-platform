import { Link } from "react-router-dom"
import { LayoutDashboard, RefreshCw, Network, ChartNoAxesColumn, Search, Route, Tag, MousePointer2 } from "lucide-react"
import { Card, LoadingSpinner } from "@/components/common"
import { AddressTable } from "@/components/table"
import { StatCard, RiskDistributionChart, TagDistribution, RecentAlerts, DashboardIcons } from "@/components/dashboard/DashboardWidgets"
import { useGraphControllerGetHighRiskAddresses, useGetPipelineStatus } from "@/api/generated"
import type { GraphAddressInfo } from "@/api/generated"

export function DashboardPage() {
  const highRiskQuery = useGraphControllerGetHighRiskAddresses({ threshold: 0.7, limit: 20 }, { query: { refetchInterval: 60000 } })
  const pipelineQuery = useGetPipelineStatus({ query: { refetchInterval: 30000 } })

  const highRiskAddresses: GraphAddressInfo[] = highRiskQuery.data || []

  // Calculate risk distribution
  const riskDistribution = {
    critical: highRiskAddresses.filter((a) => (a.riskScore ?? 0) >= 0.8).length,
    high: highRiskAddresses.filter((a) => (a.riskScore ?? 0) >= 0.6 && (a.riskScore ?? 0) < 0.8).length,
    medium: highRiskAddresses.filter((a) => (a.riskScore ?? 0) >= 0.4 && (a.riskScore ?? 0) < 0.6).length,
    low: highRiskAddresses.filter((a) => (a.riskScore ?? 0) < 0.4).length,
  }

  // Calculate tag distribution
  const tagCounts: Record<string, number> = {}
  highRiskAddresses.forEach((a) => {
    a.tags?.forEach((tag) => { tagCounts[tag] = (tagCounts[tag] || 0) + 1 })
  })
  const topTags = Object.entries(tagCounts).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count)

  // Recent alerts (from high risk addresses)
  const recentAlerts = highRiskAddresses.slice(0, 5).map((a) => ({
    address: a.address || "",
    riskScore: a.riskScore ?? 0,
    tag: a.tags?.[0] || "unknown",
    time: a.lastSeen ? formatTimeAgo(a.lastSeen) : "recently",
  }))

  const pipelineStatus = pipelineQuery.data
  const lastBlock = pipelineStatus?.ingestion?.lastBlock?.toLocaleString() || "-"
  const processedCount = pipelineStatus?.streamProcessor?.processedCount?.toLocaleString() || "-"

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <LayoutDashboard className="w-7 h-7 text-blue-600" />Dashboard
            </h1>
            <p className="text-gray-500 mt-1">Real-time on-chain risk monitoring</p>
          </div>
          <button onClick={() => { highRiskQuery.refetch(); pipelineQuery.refetch() }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${highRiskQuery.isFetching ? "animate-spin" : ""}`} />Refresh
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={DashboardIcons.Database} iconBgColor="bg-blue-100" iconColor="text-blue-600" label="Last Block" value={lastBlock} subtitle="Ethereum mainnet" />
          <StatCard icon={DashboardIcons.Shuffle} iconBgColor="bg-purple-100" iconColor="text-purple-600" label="Processed TXs" value={processedCount} subtitle="Total processed" />
          <StatCard icon={DashboardIcons.ShieldAlert} iconBgColor="bg-red-100" iconColor="text-red-600" label="High Risk" value={highRiskAddresses.length} valueColor="text-red-600" subtitle="Score ≥ 0.7" />
          <StatCard icon={DashboardIcons.AlertTriangle} iconBgColor="bg-orange-100" iconColor="text-orange-600" label="Critical" value={riskDistribution.critical} valueColor="text-orange-600" subtitle="Score ≥ 0.8" />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Risk Distribution */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Risk Distribution</h3>
                <p className="text-sm text-gray-500">By severity level</p>
              </div>
              <ChartNoAxesColumn className="w-5 h-5 text-gray-400" />
            </div>
            <RiskDistributionChart {...riskDistribution} />
          </Card>

          {/* Quick Links */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Quick Access</h3>
              <MousePointer2 className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-2">
              <QuickLink to="/address" icon={Search} color="blue" label="Address Analysis" />
              <QuickLink to="/high-risk" icon={DashboardIcons.ShieldAlert} color="red" label="High Risk Network" />
              <QuickLink to="/graph" icon={Network} color="purple" label="Graph Explorer" />
              <QuickLink to="/path-finder" icon={Route} color="green" label="Path Finder" />
              <QuickLink to="/tags" icon={Tag} color="indigo" label="Tag Search" />
            </div>
          </Card>
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Alerts */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Recent Alerts</h3>
                <p className="text-sm text-gray-500">Latest high-risk detections</p>
              </div>
            </div>
            {highRiskQuery.isLoading ? <LoadingSpinner /> : recentAlerts.length > 0 ? <RecentAlerts alerts={recentAlerts} /> : <p className="text-gray-500 text-center py-8">No recent alerts</p>}
          </Card>

          {/* Tag Distribution */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Top Tags</h3>
                <p className="text-sm text-gray-500">Most common risk tags</p>
              </div>
            </div>
            {topTags.length > 0 ? <TagDistribution tags={topTags} /> : <p className="text-gray-500 text-center py-8">No tags found</p>}
          </Card>
        </div>

        {/* High Risk Table */}
        <Card title="High-Risk Addresses" subtitle="Addresses with risk score ≥ 0.7">
          {highRiskQuery.isLoading ? (
            <div className="py-12"><LoadingSpinner /></div>
          ) : highRiskAddresses.length > 0 ? (
            <AddressTable addresses={highRiskAddresses} showTxCount showInOut showTags maxTagsDisplay={2} />
          ) : (
            <div className="text-center py-12 text-gray-500">No high-risk addresses found</div>
          )}
        </Card>
      </div>
    </div>
  )
}

// Helper Components
function QuickLink({ to, icon: Icon, color, label }: { to: string; icon: React.ElementType; color: string; label: string }) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50 hover:bg-blue-100",
    red: "text-red-600 bg-red-50 hover:bg-red-100",
    purple: "text-purple-600 bg-purple-50 hover:bg-purple-100",
    green: "text-green-600 bg-green-50 hover:bg-green-100",
    indigo: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100",
  }
  return (
    <Link to={to} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${colorMap[color]}`}>
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium text-gray-900">{label}</span>
    </Link>
  )
}

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}
