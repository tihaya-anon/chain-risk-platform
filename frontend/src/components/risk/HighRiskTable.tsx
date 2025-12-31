import { useNavigate } from "react-router-dom"
import { Search, Network as NetworkIcon, Tag, ExternalLink } from "lucide-react"
import { Button, Card } from "@/components/common"
import type { GraphAddressInfo } from "@/types"

interface HighRiskTableProps {
  addresses: GraphAddressInfo[]
}

export function HighRiskTable({ addresses }: HighRiskTableProps) {
  const navigate = useNavigate()

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Address
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Risk Score
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              TX Count
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              In/Out
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Tags
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {addresses.map((addr, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <span className="font-mono text-sm">
                  {addr.address.slice(0, 10)}...
                  {addr.address.slice(-8)}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-medium ${
                    addr.riskScore >= 0.8
                      ? "bg-red-100 text-red-800"
                      : addr.riskScore >= 0.6
                        ? "bg-orange-100 text-orange-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {addr.riskScore?.toFixed(2) || "N/A"}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">{addr.txCount}</td>
              <td className="px-4 py-3 text-sm">
                <span className="text-green-600">{addr.incomingCount}</span>
                {" / "}
                <span className="text-red-600">{addr.outgoingCount}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {addr.tags?.slice(0, 3).map((tag, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                  {addr.tags && addr.tags.length > 3 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-xs rounded">
                      +{addr.tags.length - 3}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/address?q=${addr.address}`)}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-sm cursor-pointer"
                  >
                    <Search className="w-3 h-3" />
                    Analyze
                  </button>
                  <button
                    onClick={() => navigate(`/graph?address=${addr.address}`)}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-sm cursor-pointer"
                  >
                    <NetworkIcon className="w-3 h-3" />
                    Graph
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Selected Address Panel
interface SelectedAddressPanelProps {
  address: GraphAddressInfo | null
  onAnalyze?: (address: string) => void
  onExploreGraph?: (address: string) => void
}

export function SelectedAddressPanel({
  address,
  onAnalyze,
  onExploreGraph,
}: SelectedAddressPanelProps) {
  if (!address) {
    return (
      <Card title="Selected Address">
        <p className="text-gray-500 text-sm text-center py-4">
          Click a node to see details
        </p>
      </Card>
    )
  }

  return (
    <Card title="Selected Address">
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500">Address</label>
          <p className="font-mono text-xs break-all">{address.address}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">Risk</label>
            <p className="font-medium text-red-600">{address.riskScore?.toFixed(2)}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">TX</label>
            <p className="font-medium">{address.txCount}</p>
          </div>
        </div>
        {address.tags && address.tags.length > 0 && (
          <div>
            <label className="text-xs text-gray-500">Tags</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {address.tags.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="pt-3 border-t space-y-2">
          <Button
            size="sm"
            className="w-full justify-start"
            onClick={() => onAnalyze?.(address.address)}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Full Analysis
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-start"
            onClick={() => onExploreGraph?.(address.address)}
          >
            <NetworkIcon className="w-4 h-4 mr-2" />
            Explore Graph
          </Button>
        </div>
      </div>
    </Card>
  )
}
