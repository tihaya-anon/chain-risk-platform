import { useState, useCallback } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { Network, Search, Info, ExternalLink, Activity, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { Card, Button, Input, LoadingSpinner, RiskBadge } from "@/components/common"
import { AddressGraph, AddressGraphLegend } from "@/components/graph"
import { useGraphControllerGetAddressNeighbors, useGraphControllerGetAddressInfo } from "@/api/generated"
import type { NeighborInfo } from "@/api/generated"

export function GraphExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const addressParam = searchParams.get("address") || ""

  const [searchAddress, setSearchAddress] = useState(addressParam)
  const [queryAddress, setQueryAddress] = useState(addressParam)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<NeighborInfo | null>(null)
  const [isCenter, setIsCenter] = useState(false)

  const neighborsQuery = useGraphControllerGetAddressNeighbors(queryAddress, { depth: 1, limit: 30 }, { query: { enabled: !!queryAddress } })
  const addressInfoQuery = useGraphControllerGetAddressInfo(queryAddress, { query: { enabled: !!queryAddress } })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchAddress.trim()) {
      const normalized = searchAddress.trim().toLowerCase()
      setQueryAddress(normalized)
      setSearchParams({ address: normalized })
      setSelectedNode(null)
      setHoveredNode(null)
    }
  }

  // Use useCallback to stabilize these functions
  const handleNodeHover = useCallback((neighbor: NeighborInfo | null, center?: boolean) => {
    setHoveredNode(neighbor)
    setIsCenter(!!center)
  }, [])

  const handleNodeClick = useCallback((neighbor: NeighborInfo | null, center?: boolean) => {
    if (neighbor) {
      setSelectedNode(neighbor.address || null)
      setHoveredNode(neighbor)
      setIsCenter(false)
    } else if (center) {
      setSelectedNode(queryAddress)
      setHoveredNode(null)
      setIsCenter(true)
    } else {
      setSelectedNode(null)
      setHoveredNode(null)
      setIsCenter(false)
    }
  }, [queryAddress])

  const handleNodeDoubleClick = useCallback((address: string) => {
    // Navigate to the new address
    setSearchAddress(address)
    setQueryAddress(address)
    setSearchParams({ address })
    setSelectedNode(null)
    setHoveredNode(null)
  }, [setSearchParams])

  // Display info: selected > hovered > center address
  const displayNode = selectedNode ? hoveredNode : hoveredNode
  const showCenterInfo = isCenter && !hoveredNode

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Network className="w-6 h-6 text-purple-600" />Graph Explorer
            </h1>
            <p className="text-gray-600 mt-1">Visualize address connections • Click to select • Double-click to navigate</p>
          </div>
          <Card>
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <Input placeholder="Enter Ethereum address (0x...)" value={searchAddress} onChange={(e) => setSearchAddress(e.target.value)} />
              </div>
              <Button type="submit" loading={neighborsQuery.isLoading}>
                <Search className="w-4 h-4 mr-2" />Explore
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {neighborsQuery.isLoading && (
            <div className="py-12 text-center">
              <LoadingSpinner size="lg" />
              <p className="text-gray-500 mt-4">Loading graph data...</p>
            </div>
          )}

          {neighborsQuery.data && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Graph */}
              <div className="lg:col-span-3 space-y-4">
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">Network Graph</h3>
                      <p className="text-sm text-gray-500">{neighborsQuery.data.neighbors?.length || 0} connected addresses</p>
                    </div>
                    <AddressGraphLegend />
                  </div>
                  <AddressGraph
                    data={neighborsQuery.data}
                    selectedNode={selectedNode}
                    onNodeHover={handleNodeHover}
                    onNodeClick={handleNodeClick}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    height="500px"
                  />
                </Card>
              </div>

              {/* Info Panel */}
              <div className="space-y-4">
                {/* Center Address Info */}
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Center Address</h3>
                  </div>
                  {addressInfoQuery.isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : addressInfoQuery.data ? (
                    <div className="space-y-3 text-sm">
                      <p className="font-mono text-xs text-gray-700 break-all bg-gray-50 p-2 rounded">{addressInfoQuery.data.address}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-xs">Risk Score</label>
                          <p className="font-semibold">{addressInfoQuery.data.riskScore?.toFixed(2) || "N/A"}</p>
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs">TX Count</label>
                          <p className="font-semibold">{addressInfoQuery.data.txCount?.toLocaleString() || "N/A"}</p>
                        </div>
                      </div>
                      {addressInfoQuery.data.tags && addressInfoQuery.data.tags.length > 0 && (
                        <div>
                          <label className="text-gray-500 text-xs block mb-1">Tags</label>
                          <div className="flex flex-wrap gap-1">
                            {addressInfoQuery.data.tags.slice(0, 4).map((tag, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <Link to={`/address?q=${queryAddress}`} className="flex items-center gap-1 text-blue-600 hover:underline text-xs mt-2">
                        <ExternalLink className="w-3 h-3" />Full Analysis
                      </Link>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No data</p>
                  )}
                </Card>

                {/* Selected/Hovered Node Info */}
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-purple-600" />
                    <h3 className="font-semibold text-gray-900">{selectedNode ? "Selected" : "Hovered"} Node</h3>
                  </div>
                  {displayNode ? (
                    <div className="space-y-3 text-sm">
                      <p className="font-mono text-xs text-gray-700 break-all bg-gray-50 p-2 rounded">{displayNode.address}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-xs">Direction</label>
                          <div className="flex items-center gap-1 mt-0.5">
                            {displayNode.direction === "incoming" && <ArrowDownLeft className="w-4 h-4 text-green-600" />}
                            {displayNode.direction === "outgoing" && <ArrowUpRight className="w-4 h-4 text-red-600" />}
                            {displayNode.direction === "both" && <><ArrowDownLeft className="w-3 h-3 text-purple-600" /><ArrowUpRight className="w-3 h-3 text-purple-600" /></>}
                            <span className="font-medium capitalize">{displayNode.direction}</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs">Transfers</label>
                          <p className="font-semibold">{displayNode.transferCount?.toLocaleString() || "0"}</p>
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs">Risk Score</label>
                          <RiskBadge score={displayNode.riskScore} size="sm" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs">Total Value</label>
                          <p className="font-semibold text-xs">{formatValue(displayNode.totalValue)}</p>
                        </div>
                      </div>
                      {displayNode.tags && displayNode.tags.length > 0 && (
                        <div>
                          <label className="text-gray-500 text-xs block mb-1">Tags</label>
                          <div className="flex flex-wrap gap-1">
                            {displayNode.tags.slice(0, 4).map((tag, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleNodeDoubleClick(displayNode.address || "")} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-100 text-purple-700 text-xs font-medium rounded hover:bg-purple-200 transition-colors">
                          <Network className="w-3 h-3" />Explore
                        </button>
                        <Link to={`/address?q=${displayNode.address}`} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200 transition-colors">
                          <ExternalLink className="w-3 h-3" />Details
                        </Link>
                      </div>
                    </div>
                  ) : showCenterInfo ? (
                    <p className="text-gray-500 text-sm">Center address selected</p>
                  ) : (
                    <p className="text-gray-500 text-sm">Hover or click a node to see details</p>
                  )}
                </Card>
              </div>
            </div>
          )}

          {!neighborsQuery.isLoading && !neighborsQuery.data && !queryAddress && (
            <div className="text-center py-16">
              <Network className="w-16 h-16 text-gray-300 mx-auto" />
              <h3 className="text-lg font-medium text-gray-900 mt-4">Explore Address Connections</h3>
              <p className="text-gray-500 mt-2">Enter an Ethereum address to visualize its transaction network</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatValue(value?: string): string {
  if (!value) return "-"
  const num = parseFloat(value)
  if (isNaN(num)) return value
  if (num >= 1e18) return `${(num / 1e18).toFixed(2)} ETH`
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`
  return num.toLocaleString()
}
