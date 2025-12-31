import {
  Tag,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  MousePointer,
  MousePointerClick,
} from "lucide-react"
import { Card } from "@/components/common"
import type { HoveredNodeInfo } from "@/components/graph/AddressGraph"

interface NodeInfoPanelProps {
  displayNode: HoveredNodeInfo | null
  isSelected: boolean
  onClearSelection?: () => void
}

export function NodeInfoPanel({
  displayNode,
  isSelected,
  onClearSelection,
}: NodeInfoPanelProps) {
  return (
    <Card
      title={isSelected ? "Selected Node" : "Hovered Node"}
      className={isSelected ? "ring-2 ring-blue-500" : ""}
    >
      {displayNode ? (
        <div className="space-y-3">
          {isSelected && (
            <div className="flex justify-end">
              <button
                onClick={onClearSelection}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear selection
              </button>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500">Address</label>
            <p className="font-mono text-xs break-all">{displayNode.address}</p>
          </div>
          {displayNode.isCenter ? (
            <div className="py-2 px-3 bg-blue-50 rounded-lg text-center">
              <span className="text-sm text-blue-700 font-medium">Center Address</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Risk Score</label>
                  <p
                    className={`font-medium ${
                      (displayNode.riskScore ?? 0) >= 0.6
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {displayNode.riskScore?.toFixed(2) || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Transfers</label>
                  <p className="font-medium">{displayNode.transferCount || 0}</p>
                </div>
              </div>
              {displayNode.direction && (
                <div>
                  <label className="text-xs text-gray-500">Direction</label>
                  <div className="flex items-center gap-2 mt-1">
                    {displayNode.direction === "incoming" && (
                      <>
                        <ArrowDownLeft className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600">Incoming</span>
                      </>
                    )}
                    {displayNode.direction === "outgoing" && (
                      <>
                        <ArrowUpRight className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-red-600">Outgoing</span>
                      </>
                    )}
                    {displayNode.direction === "both" && (
                      <>
                        <ArrowLeftRight className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-600">Bidirectional</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              {displayNode.tags && displayNode.tags.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500">Tags</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {displayNode.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400">
          {isSelected ? (
            <>
              <MousePointerClick className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Click a node to select it</p>
            </>
          ) : (
            <>
              <MousePointer className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Hover over a node to see details</p>
            </>
          )}
        </div>
      )}
    </Card>
  )
}

// Center Address Info Panel
interface CenterAddressInfoProps {
  addressInfo: {
    address: string
    riskScore?: number
    txCount: number
    incomingCount: number
    outgoingCount: number
    clusterId?: string
  } | null
}

export function CenterAddressInfo({ addressInfo }: CenterAddressInfoProps) {
  if (!addressInfo) {
    return (
      <Card title="Center Address">
        <p className="text-gray-500 text-sm">No info available</p>
      </Card>
    )
  }

  return (
    <Card title="Center Address">
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500">Address</label>
          <p className="font-mono text-xs break-all">{addressInfo.address}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">Risk Score</label>
            <p className="font-medium">{addressInfo.riskScore?.toFixed(2) || "N/A"}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">TX Count</label>
            <p className="font-medium">{addressInfo.txCount}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Incoming</label>
            <p className="font-medium text-green-600">{addressInfo.incomingCount}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Outgoing</label>
            <p className="font-medium text-red-600">{addressInfo.outgoingCount}</p>
          </div>
        </div>
        {addressInfo.clusterId && (
          <div>
            <label className="text-xs text-gray-500">Cluster</label>
            <p className="font-mono text-xs truncate">{addressInfo.clusterId}</p>
          </div>
        )}
      </div>
    </Card>
  )
}

// Top Neighbors List
interface TopNeighborsProps {
  neighbors: Array<{
    address: string
    transferCount: number
    direction: string
    riskScore?: number
  }>
  onNavigate: (address: string) => void
}

export function TopNeighborsList({ neighbors, onNavigate }: TopNeighborsProps) {
  if (neighbors.length === 0) {
    return (
      <Card title="Top Neighbors" subtitle="By transfer count">
        <p className="text-gray-500 text-sm">No neighbors found</p>
      </Card>
    )
  }

  return (
    <Card title="Top Neighbors" subtitle="By transfer count">
      <div className="space-y-2">
        {neighbors.slice(0, 5).map((neighbor, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
            onClick={() => onNavigate(neighbor.address)}
          >
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs truncate">
                {neighbor.address.slice(0, 10)}...
              </p>
              <p className="text-xs text-gray-500">{neighbor.transferCount} transfers</p>
            </div>
            <div className="flex items-center gap-2">
              {neighbor.direction === "incoming" && (
                <ArrowDownLeft className="w-4 h-4 text-green-600" />
              )}
              {neighbor.direction === "outgoing" && (
                <ArrowUpRight className="w-4 h-4 text-red-600" />
              )}
              {neighbor.direction === "both" && (
                <ArrowLeftRight className="w-4 h-4 text-gray-600" />
              )}
              {neighbor.riskScore !== undefined && (
                <span
                  className={`px-1.5 py-0.5 text-xs rounded ${
                    neighbor.riskScore >= 0.6
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {neighbor.riskScore.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
