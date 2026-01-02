import { Link } from "react-router-dom"
import { ExternalLink, Network, Tag } from "lucide-react"
import { RiskBadge } from "@/components/common"
import type { GraphAddressInfo } from "@/types"

interface AddressTableProps {
  addresses: GraphAddressInfo[]
  showTxCount?: boolean
  showInOut?: boolean
  showTags?: boolean
  showLastSeen?: boolean
  maxTagsDisplay?: number
}

export function AddressTable({
  addresses,
  showTxCount = true,
  showInOut = false,
  showTags = true,
  showLastSeen = false,
  maxTagsDisplay = 2,
}: AddressTableProps) {
  const formatTime = (isoString?: string) => {
    if (!isoString) return "-"
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Address
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Risk Level
            </th>
            {showTxCount && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transactions
              </th>
            )}
            {showInOut && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                In / Out
              </th>
            )}
            {showTags && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tags
              </th>
            )}
            {showLastSeen && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Seen
              </th>
            )}
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {addresses.map((addr) => (
            <tr key={addr.address} className="hover:bg-gray-50 transition-colors">
              {/* Address */}
              <td className="px-4 py-3">
                <Link
                  to={`/address?q=${addr.address}`}
                  className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {addr.address.slice(0, 10)}...{addr.address.slice(-8)}
                </Link>
              </td>

              {/* Risk Badge */}
              <td className="px-4 py-3">
                <RiskBadge score={addr.riskScore} size="sm" />
              </td>

              {/* TX Count */}
              {showTxCount && (
                <td className="px-4 py-3 text-sm text-gray-700">
                  {addr.txCount?.toLocaleString() || "-"}
                </td>
              )}

              {/* In/Out */}
              {showInOut && (
                <td className="px-4 py-3 text-sm">
                  <span className="text-green-600">{addr.incomingCount || 0}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-red-600">{addr.outgoingCount || 0}</span>
                </td>
              )}

              {/* Tags */}
              {showTags && (
                <td className="px-4 py-3">
                  {addr.tags && addr.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {addr.tags.slice(0, maxTagsDisplay).map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                      {addr.tags.length > maxTagsDisplay && (
                        <span className="px-2 py-0.5 text-xs text-gray-500">
                          +{addr.tags.length - maxTagsDisplay}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">No tags</span>
                  )}
                </td>
              )}

              {/* Last Seen */}
              {showLastSeen && (
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatTime(addr.lastSeen)}
                </td>
              )}

              {/* Actions */}
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    to={`/address?q=${addr.address}`}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                    title="View Details"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Details
                  </Link>
                  <Link
                    to={`/graph?address=${addr.address}`}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors"
                    title="View Graph"
                  >
                    <Network className="w-3 h-3" />
                    Graph
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Empty State */}
      {addresses.length === 0 && (
        <div className="text-center py-8 text-gray-500">No addresses found</div>
      )}
    </div>
  )
}
