import { AddressTable } from "@/components/table"
import { Card, Button } from "@/components/common"
import { ExternalLink, Network, Tag } from "lucide-react"
import type { GraphAddressInfo } from "@/types"

interface HighRiskTableProps {
  addresses: GraphAddressInfo[]
}

export function HighRiskTable({ addresses }: HighRiskTableProps) {
  return (
    <AddressTable
      addresses={addresses}
      showTxCount={true}
      showInOut={true}
      showTags={true}
      showLastSeen={false}
      maxTagsDisplay={3}
    />
  )
}

// Selected Address Panel for graph view
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
            <Network className="w-4 h-4 mr-2" />
            Explore Graph
          </Button>
        </div>
      </div>
    </Card>
  )
}
