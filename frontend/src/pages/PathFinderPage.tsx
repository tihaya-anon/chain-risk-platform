import { useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import {
  Route,
  Search,
  ArrowRight,
  CheckCircle,
  XCircle,
  ExternalLink,
  Tag,
  AlertTriangle,
} from "lucide-react"
import { Card, Button, Input, LoadingSpinner, RiskBadge } from "@/components/common"
import { useFindConnection } from "@/api/generated"

export function PathFinderPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [fromAddress, setFromAddress] = useState(searchParams.get("from") || "")
  const [toAddress, setToAddress] = useState(searchParams.get("to") || "")
  const [queryFrom, setQueryFrom] = useState("")
  const [queryTo, setQueryTo] = useState("")

  const connectionQuery = useFindConnection(
    queryFrom,
    queryTo,
    { maxDepth: 5 },
    { query: { enabled: !!(queryFrom && queryTo) } }
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (fromAddress.trim() && toAddress.trim()) {
      const from = fromAddress.trim().toLowerCase()
      const to = toAddress.trim().toLowerCase()
      setQueryFrom(from)
      setQueryTo(to)
      setSearchParams({ from, to })
    }
  }

  const data = connectionQuery.data

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Route className="w-6 h-6 text-green-600 dark:text-green-400" />
              Path Finder
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Find transaction paths between addresses
            </p>
          </div>

          <Card>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Source Address"
                  placeholder="0x..."
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                />
                <Input
                  label="Target Address"
                  placeholder="0x..."
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                loading={connectionQuery.isLoading}
                disabled={!fromAddress.trim() || !toAddress.trim()}
              >
                <Search className="w-4 h-4 mr-2" />
                Find Connection
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {connectionQuery.isLoading && (
            <div className="py-12">
              <LoadingSpinner size="lg" />
              <p className="text-center text-gray-500 dark:text-gray-400 mt-4">
                Searching for connections...
              </p>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* Address Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AddressCard
                  title="Source Address"
                  address={data.fromAddress}
                  risk={data.fromAddressRisk}
                  color="blue"
                />
                <AddressCard
                  title="Target Address"
                  address={data.toAddress}
                  risk={data.toAddressRisk}
                  color="purple"
                />
              </div>

              {/* Path Result */}
              <Card>
                <div className="p-2">
                  {data.path?.found ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
                          <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Connection Found
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400">
                            {data.path.pathLength} hop
                            {data.path.pathLength !== 1 ? "s" : ""} between addresses
                          </p>
                        </div>
                      </div>

                      {/* Visual Path */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 overflow-x-auto">
                        <div className="flex items-center justify-around">
                          {data.path.path?.flatMap((node, i) => {
                            const elements = [
                              <PathNodeCard
                                key={`node-${i}`}
                                node={node}
                                index={i}
                                isLast={i === (data.path?.path?.length || 0) - 1}
                              />,
                            ]
                            if (i < (data.path?.path?.length || 0) - 1) {
                              elements.push(
                                <div
                                  key={`arrow-${i}`}
                                  className="flex flex-col items-center px-2"
                                >
                                  <ArrowRight className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                                  <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    tx
                                  </span>
                                </div>
                              )
                            }
                            return elements
                          })}
                        </div>
                      </div>

                      {/* Path Details Table */}
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                          Path Details
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                  Step
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                  Address
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                  Risk
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                  Value
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                  Tags
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {data.path.path?.map((node, i) => (
                                <tr
                                  key={i}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                >
                                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                    {i + 1}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Link
                                      to={`/address?q=${node.address}`}
                                      className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      {node.address?.slice(0, 10)}...
                                      {node.address?.slice(-8)}
                                    </Link>
                                  </td>
                                  <td className="px-4 py-3">
                                    <RiskBadge score={node.riskScore} size="sm" />
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                    {formatValue(node.value)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                      {node.tags?.slice(0, 2).map((tag, j) => (
                                        <span
                                          key={j}
                                          className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full inline-flex mb-4">
                        <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        No Connection Found
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">
                        No path exists within {data.path?.maxDepth || 6} hops
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {!connectionQuery.isLoading && !data && (
            <div className="text-center py-16">
              <Route className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-4">
                Find Transaction Paths
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Enter two addresses to discover how they are connected through on-chain
                transactions
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper Components

interface AddressCardProps {
  title: string
  address?: string
  risk?: { riskScore?: number; riskLevel?: string; tags?: string[] }
  color: "blue" | "purple"
}

function AddressCard({ title, address, risk, color }: AddressCardProps) {
  const colorClasses = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-900/30",
      border: "border-blue-200 dark:border-blue-800",
      icon: "text-blue-600 dark:text-blue-400",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-900/30",
      border: "border-purple-200 dark:border-purple-800",
      icon: "text-purple-600 dark:text-purple-400",
    },
  }
  const c = colorClasses[color]

  return (
    <div className={`${c.bg} ${c.border} border rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        <Link to={`/address?q=${address}`} className={`${c.icon} hover:opacity-70`}>
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
      <p className="font-mono text-sm text-gray-700 dark:text-gray-300 break-all mb-4">
        {address}
      </p>
      <div className="flex items-center justify-between">
        <RiskBadge score={risk?.riskScore} level={risk?.riskLevel as any} />
        {risk?.tags && risk.tags.length > 0 && (
          <div className="flex items-center gap-1">
            <Tag className="w-3 h-3 text-gray-400 dark:text-gray-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {risk.tags.length} tags
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

interface PathNodeCardProps {
  node: { address?: string; riskScore?: number; tags?: string[]; value?: string }
  index: number
  isLast: boolean
}

function PathNodeCard({ node, index, isLast }: PathNodeCardProps) {
  const isHighRisk = (node.riskScore ?? 0) >= 0.7

  return (
    <div
      className={`relative p-4 bg-white dark:bg-gray-800 rounded-xl border-2 min-w-[180px] ${isHighRisk ? "border-red-300 dark:border-red-700" : "border-gray-200 dark:border-gray-600"} shadow-sm`}
    >
      {isHighRisk && (
        <div className="absolute -top-2 -right-2 p-1 bg-red-100 dark:bg-red-900/50 rounded-full">
          <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
        </div>
      )}
      <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">
        {index === 0 ? "Start" : isLast ? "End" : `Hop ${index}`}
      </div>
      <Link
        to={`/address?q=${node.address}`}
        className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline block truncate"
      >
        {node.address?.slice(0, 8)}...{node.address?.slice(-6)}
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <RiskBadge score={node.riskScore} size="sm" />
      </div>
    </div>
  )
}

function formatValue(value?: string): string {
  if (!value) return "-"
  const num = parseFloat(value)
  if (isNaN(num)) return value
  if (num >= 1e18) return `${(num / 1e18).toFixed(4)} ETH`
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
  return num.toLocaleString()
}
