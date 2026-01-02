import { Link } from "react-router-dom"
import {
  Network,
  Hash,
  Activity,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Tag,
  Box,
} from "lucide-react"
import { RiskBadge } from "@/components/common"
import type { AddressAnalysis } from "@/types"

// Helper to check if response is an error
function isError(obj: unknown): obj is { error: string } {
  return typeof obj === "object" && obj !== null && "error" in obj
}

// Format value helper
function formatValue(value: string | undefined): string {
  if (!value) return "N/A"
  const num = parseFloat(value)
  if (isNaN(num)) return value
  if (num >= 1e18) return `${(num / 1e18).toFixed(4)} ETH`
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
  return num.toLocaleString()
}

// Basic Information Section
export function BasicInfoSection({ data }: { data: AddressAnalysis }) {
  const info = isError(data.basic.addressInfo) ? null : data.basic.addressInfo

  if (!info) {
    return (
      <div className="text-center py-4 text-gray-500">
        <p>Address info unavailable</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-gray-500 flex items-center gap-1">
          <Hash className="w-3 h-3" />
          Address
        </label>
        <p className="font-mono text-sm break-all">{info.address}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm text-gray-500 flex items-center gap-1">
            <Network className="w-3 h-3" />
            Network
          </label>
          <p className="font-medium">{info.network}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Total Transactions
          </label>
          <p className="font-medium">{info.totalTxCount?.toLocaleString()}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500 flex items-center gap-1">
            <Users className="w-3 h-3" />
            Unique Counterparties
          </label>
          <p className="font-medium">{info.uniqueInteracted?.toLocaleString()}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            Sent
          </label>
          <p className="font-medium text-red-600">{info.sentTxCount?.toLocaleString()}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500 flex items-center gap-1">
            <ArrowDownLeft className="w-3 h-3" />
            Received
          </label>
          <p className="font-medium text-green-600">
            {info.receivedTxCount?.toLocaleString()}
          </p>
        </div>
        <div>
          <label className="text-sm text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            First Seen
          </label>
          <p className="font-medium">
            {info.firstSeen ? new Date(info.firstSeen).toLocaleDateString() : "N/A"}
          </p>
        </div>
        <div>
          <label className="text-sm text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Last Seen
          </label>
          <p className="font-medium">
            {info.lastSeen ? new Date(info.lastSeen).toLocaleDateString() : "N/A"}
          </p>
        </div>
      </div>
    </div>
  )
}

// Risk Assessment Section
export function RiskSection({ data }: { data: AddressAnalysis }) {
  const risk = isError(data.basic.riskScore) ? null : data.basic.riskScore

  if (!risk) {
    return (
      <div className="text-center py-4 text-gray-500">
        <p>Risk score unavailable</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-4xl font-bold">{risk.riskScore.toFixed(2)}</div>
        <div className="mt-2">
          <RiskBadge level={risk.riskLevel} size="lg" />
        </div>
      </div>

      {risk.factors && risk.factors.filter((f) => f.triggered).length > 0 && (
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Triggered Factors</h4>
          <div className="space-y-2">
            {risk.factors
              .filter((f) => f.triggered)
              .map((factor, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{factor.name}</span>
                  <span className="font-medium">{factor.score.toFixed(2)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {risk.tags && risk.tags.length > 0 && (
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Risk Tags</h4>
          <div className="flex flex-wrap gap-1">
            {risk.tags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Graph Analysis Section
export function GraphInfoSection({ data }: { data: AddressAnalysis }) {
  const graphInfo = isError(data.graph.graphInfo) ? null : data.graph.graphInfo
  const tags = data.graph.tags || []

  return (
    <div className="space-y-4">
      {graphInfo ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-500 flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3" />
              Incoming Transfers
            </label>
            <p className="font-medium text-green-600 text-xl">
              {graphInfo.incomingCount}
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-500 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              Outgoing Transfers
            </label>
            <p className="font-medium text-red-600 text-xl">{graphInfo.outgoingCount}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Graph Risk Score</label>
            <p className="font-medium text-xl">
              {graphInfo.riskScore?.toFixed(2) || "N/A"}
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-500 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Total TX Count
            </label>
            <p className="font-medium text-xl">{graphInfo.txCount}</p>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Graph info unavailable</p>
      )}

      {tags.length > 0 && (
        <div className="pt-4 border-t">
          <label className="text-sm text-gray-500 block mb-2">Address Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {tags.length === 0 && graphInfo && (
        <div className="pt-4 border-t">
          <p className="text-gray-500 text-sm">No tags associated</p>
        </div>
      )}
    </div>
  )
}

// Cluster Section
export function ClusterSection({ data }: { data: AddressAnalysis }) {
  const cluster = isError(data.graph.cluster) ? null : data.graph.cluster

  if (!cluster) {
    return (
      <div className="text-center py-4">
        <Box className="w-8 h-8 text-gray-300 mx-auto" />
        <p className="text-gray-500 text-sm mt-2">Not in any cluster</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm text-gray-500">Cluster ID</label>
        <p className="font-mono text-sm truncate" title={cluster.clusterId}>
          {cluster.clusterId}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500">Size</label>
          <p className="font-medium">{cluster.size} addresses</p>
        </div>
        <div>
          <label className="text-sm text-gray-500">Risk Score</label>
          <p className="font-medium">{cluster.riskScore?.toFixed(2) || "N/A"}</p>
        </div>
      </div>
      {cluster.label && (
        <div>
          <label className="text-sm text-gray-500">Label</label>
          <p className="font-medium">{cluster.label}</p>
        </div>
      )}
      {cluster.category && (
        <div>
          <label className="text-sm text-gray-500">Category</label>
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
            {cluster.category}
          </span>
        </div>
      )}
      {cluster.tags && cluster.tags.length > 0 && (
        <div>
          <label className="text-sm text-gray-500 block mb-1">Cluster Tags</label>
          <div className="flex flex-wrap gap-1">
            {cluster.tags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Neighbors Section
export function NeighborsSection({ data }: { data: AddressAnalysis }) {
  const neighbors = isError(data.graph.neighbors) ? null : data.graph.neighbors

  if (!neighbors || neighbors.neighbors.length === 0) {
    return (
      <div className="text-center py-8">
        <Network className="w-12 h-12 text-gray-300 mx-auto" />
        <p className="text-gray-500 mt-2">No connected addresses found</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 text-sm text-gray-500">
        Showing {neighbors.neighbors.length} of {neighbors.totalCount} connected addresses
        (depth: {neighbors.depth})
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Address
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Direction
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transfers
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Value
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Risk
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tags
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {neighbors.neighbors.map((neighbor, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    to={`/address?q=${neighbor.address}`}
                    className="font-mono text-sm text-blue-600 hover:underline"
                  >
                    {neighbor.address.slice(0, 10)}...
                    {neighbor.address.slice(-8)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
                      neighbor.direction === "incoming"
                        ? "bg-green-100 text-green-700"
                        : neighbor.direction === "outgoing"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {neighbor.direction === "incoming" && (
                      <ArrowDownLeft className="w-3 h-3" />
                    )}
                    {neighbor.direction === "outgoing" && (
                      <ArrowUpRight className="w-3 h-3" />
                    )}
                    {neighbor.direction}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  {neighbor.transferCount}
                </td>
                <td className="px-4 py-3 text-sm">{formatValue(neighbor.totalValue)}</td>
                <td className="px-4 py-3">
                  <RiskScoreIndicator score={neighbor.riskScore} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {neighbor.tags?.slice(0, 3).map((tag, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                    {neighbor.tags && neighbor.tags.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-xs rounded">
                        +{neighbor.tags.length - 3}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Risk Score Indicator
export function RiskScoreIndicator({ score }: { score: number | undefined }) {
  if (score === undefined || score === null) {
    return <span className="text-gray-400 text-sm">N/A</span>
  }

  const getColor = (s: number) => {
    if (s >= 0.8) return "text-red-600 bg-red-100"
    if (s >= 0.6) return "text-orange-600 bg-orange-100"
    if (s >= 0.4) return "text-yellow-600 bg-yellow-100"
    return "text-green-600 bg-green-100"
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${getColor(score)}`}
    >
      {score.toFixed(2)}
    </span>
  )
}
