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
import { useGraphControllerGetHighRiskAddresses } from "@/api/generated"
import type { GraphAddressInfo } from "@/api/generated"

export function DashboardPage() {
  const highRiskQuery = useGraphControllerGetHighRiskAddresses(
    { threshold: 0.7, limit: 10 },
    {
      query: { refetchInterval: 60000 },
    }
  )

  const highRiskAddresses: GraphAddressInfo[] = highRiskQuery.data || []

  const riskDistribution = {
    critical: highRiskAddresses.filter((a: GraphAddressInfo) => (a.riskScore ?? 0) >= 0.8)
      .length,
    high: highRiskAddresses.filter(
      (a: GraphAddressInfo) => (a.riskScore ?? 0) >= 0.6 && (a.riskScore ?? 0) < 0.8
    ).length,
    medium: highRiskAddresses.filter(
      (a: GraphAddressInfo) => (a.riskScore ?? 0) >= 0.4 && (a.riskScore ?? 0) < 0.6
    ).length,
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-blue-600" />
              Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Overview of on-chain risk analysis</p>
          </div>
          <button
            onClick={() => highRiskQuery.refetch()}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${highRiskQuery.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Addresses</p>
                <p className="text-2xl font-bold text-gray-900">-</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Network className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Transfers</p>
                <p className="text-2xl font-bold text-gray-900">-</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <ShieldAlert className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">High Risk</p>
                <p className="text-2xl font-bold text-red-600">
                  {highRiskAddresses.length}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-600">
                  Online
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Risk Distribution</h3>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-gray-500">Critical</div>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${(riskDistribution.critical / Math.max(highRiskAddresses.length, 1)) * 100}%`,
                    }}
                  />
                </div>
                <div className="w-12 text-sm font-medium text-right">
                  {riskDistribution.critical}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-gray-500">High</div>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${(riskDistribution.high / Math.max(highRiskAddresses.length, 1)) * 100}%`,
                    }}
                  />
                </div>
                <div className="w-12 text-sm font-medium text-right">
                  {riskDistribution.high}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-gray-500">Medium</div>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${(riskDistribution.medium / Math.max(highRiskAddresses.length, 1)) * 100}%`,
                    }}
                  />
                </div>
                <div className="w-12 text-sm font-medium text-right">
                  {riskDistribution.medium}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Quick Links</h3>
              <Clock className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-2">
              <Link
                to="/address"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Database className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">
                  Address Analysis
                </span>
              </Link>
              <Link
                to="/high-risk"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-gray-900">
                  High Risk Network
                </span>
              </Link>
              <Link
                to="/graph"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Network className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-900">Graph Explorer</span>
              </Link>
              <Link
                to="/path-finder"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Users className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-900">Path Finder</span>
              </Link>
            </div>
          </Card>
        </div>

        <Card
          title="Recent High-Risk Addresses"
          subtitle="Addresses with risk score ≥ 0.7"
        >
          {highRiskQuery.isLoading ? (
            <div className="py-8">
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
            <div className="text-center py-8 text-gray-500">
              No high-risk addresses found
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
