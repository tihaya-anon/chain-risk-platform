import { useState, useCallback, useMemo } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { Network, Search, Info, ExternalLink, Activity } from "lucide-react"
import { Card, Button, Input, LoadingSpinner, RiskBadge } from "@/components/common"
import { AddressGraph, AddressGraphLegend } from "@/components/graph"
import { useGraphControllerGetAddressNeighbors, useGraphControllerGetAddressInfo } from "@/api/generated"
import type { GraphNode } from "@/api/generated"

const DEPTH_OPTIONS = [
  { value: 1, label: "1 hop", description: "Direct neighbors" },
  { value: 2, label: "2 hops", description: "Extended network" },
  { value: 3, label: "3 hops", description: "Deep analysis" },
]

export function GraphExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const addressParam = searchParams.get("address") || ""
  const depthParam = parseInt(searchParams.get("depth") || "1", 10)

  const [searchAddress, setSearchAddress] = useState(addressParam)
  const [queryAddress, setQueryAddress] = useState(addressParam)
  const [depth, setDepth] = useState(Math.min(Math.max(depthParam, 1), 3))
  
  // Separate hover and selected states
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [isHoveredCenter, setIsHoveredCenter] = useState(false)
  const [isSelectedCenter, setIsSelectedCenter] = useState(false)

  const neighborsQuery = useGraphControllerGetAddressNeighbors(
    queryAddress,
    { depth, limit: 50 },
    { query: { enabled: !!queryAddress } }
  )
  const addressInfoQuery = useGraphControllerGetAddressInfo(queryAddress, { query: { enabled: !!queryAddress } })

  // Display node: selected takes priority, then hovered
  const displayNode = selectedNode || hoveredNode
  const isDisplaySelected = !!selectedNode
  const showCenterInfo = (isSelectedCenter && !selectedNode) || (isHoveredCenter && !hoveredNode && !selectedNode)

  // Calculate edge info for display node
  const displayNodeEdgeInfo = useMemo(() => {
    if (!displayNode || !neighborsQuery.data?.edges) return null
    const edges = neighborsQuery.data.edges
    const centerAddr = neighborsQuery.data.address

    const nodeEdges = edges.filter(
      (e) => e.from === displayNode.address || e.to === displayNode.address
    )

    const totalTransfers = nodeEdges.reduce((sum, e) => sum + (e.transferCount || 0), 0)
    const totalValue = nodeEdges.reduce((sum, e) => sum + parseFloat(e.totalValue || "0"), 0)

    const inEdges = edges.filter((e) => e.from === displayNode.address && e.to === centerAddr)
    const outEdges = edges.filter((e) => e.from === centerAddr && e.to === displayNode.address)

    let direction: "incoming" | "outgoing" | "both" | "indirect" | undefined
    if (inEdges.length > 0 && outEdges.length > 0) direction = "both"
    else if (inEdges.length > 0) direction = "incoming"
    else if (outEdges.length > 0) direction = "outgoing"
    else if (nodeEdges.length > 0) direction = "indirect"

    return { direction, totalTransfers, totalValue: totalValue.toFixed(4), edgeCount: nodeEdges.length }
  }, [displayNode, neighborsQuery.data])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchAddress.trim()) {
      const normalized = searchAddress.trim().toLowerCase()
      setQueryAddress(normalized)
      setSearchParams({ address: normalized, depth: String(depth) })
      setSelectedNode(null)
      setHoveredNode(null)
      setIsSelectedCenter(false)
      setIsHoveredCenter(false)
    }
  }

  const handleDepthChange = (newDepth: number) => {
    setDepth(newDepth)
    if (queryAddress) {
      setSearchParams({ address: queryAddress, depth: String(newDepth) })
    }
  }

  const handleNodeHover = useCallback((node: GraphNode | null, center?: boolean) => {
    setHoveredNode(node)
    setIsHoveredCenter(!!center && !node)
  }, [])

  const handleNodeClick = useCallback((node: GraphNode | null, center?: boolean) => {
    if (center && !node) {
      // Clicked on center
      if (isSelectedCenter) {
        // Deselect center
        setIsSelectedCenter(false)
        setSelectedNode(null)
      } else {
        setIsSelectedCenter(true)
        setSelectedNode(null)
      }
    } else if (node) {
      // Clicked on a node
      if (selectedNode?.address === node.address) {
        // Deselect
        setSelectedNode(null)
        setIsSelectedCenter(false)
      } else {
        setSelectedNode(node)
        setIsSelectedCenter(false)
      }
    } else {
      // Clicked on empty space
      setSelectedNode(null)
      setIsSelectedCenter(false)
    }
  }, [selectedNode, isSelectedCenter])

  const handleNodeDoubleClick = useCallback(
    (address: string) => {
      setSearchAddress(address)
      setQueryAddress(address)
      setSearchParams({ address, depth: String(depth) })
      setSelectedNode(null)
      setHoveredNode(null)
      setIsSelectedCenter(false)
      setIsHoveredCenter(false)
    },
    [setSearchParams, depth]
  )

  const nodeCount = (neighborsQuery.data?.nodes?.length || 1) - 1
  const selectedAddress = selectedNode?.address || (isSelectedCenter ? queryAddress : null)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Network className="w-6 h-6 text-purple-600" />
              Graph Explorer
            </h1>
            <p className="text-gray-600 mt-1">
              Radial graph visualization • Click to select • Double-click to navigate
            </p>
          </div>
          <Card>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Enter Ethereum address (0x...)"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  {DEPTH_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleDepthChange(opt.value)}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${
                        depth === opt.value
                          ? "bg-purple-600 text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                      title={opt.description}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <Button type="submit" loading={neighborsQuery.isLoading}>
                  <Search className="w-4 h-4 mr-2" />
                  Explore
                </Button>
              </div>
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

          {!!neighborsQuery.error && (
            <div className="py-12 text-center">
              <p className="text-red-500">Failed to load graph data</p>
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
                      <p className="text-sm text-gray-500">
                        {nodeCount} connected addresses • {neighborsQuery.data.edges?.length || 0}{" "}
                        edges • depth {neighborsQuery.data.depth || depth}
                      </p>
                    </div>
                    <AddressGraphLegend />
                  </div>
                  <AddressGraph
                    data={neighborsQuery.data}
                    selectedNode={selectedAddress}
                    onNodeHover={handleNodeHover}
                    onNodeClick={handleNodeClick}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    height="550px"
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
                      <p className="font-mono text-xs text-gray-700 break-all bg-gray-50 p-2 rounded">
                        {addressInfoQuery.data.address}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-xs">Risk Score</label>
                          <RiskBadge score={addressInfoQuery.data.riskScore} size="sm" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs">TX Count</label>
                          <p className="font-semibold">
                            {addressInfoQuery.data.txCount?.toLocaleString() || "N/A"}
                          </p>
                        </div>
                      </div>
                      {addressInfoQuery.data.tags && addressInfoQuery.data.tags.length > 0 && (
                        <div>
                          <label className="text-gray-500 text-xs block mb-1">Tags</label>
                          <div className="flex flex-wrap gap-1">
                            {addressInfoQuery.data.tags.slice(0, 4).map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <Link
                        to={`/address?q=${queryAddress}`}
                        className="flex items-center gap-1 text-blue-600 hover:underline text-xs mt-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Full Analysis
                      </Link>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No data</p>
                  )}
                </Card>

                {/* Hovered/Selected Node Info */}
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600" />
                      <h3 className="font-semibold text-gray-900">
                        {isDisplaySelected ? "Selected" : "Hovered"} Node
                      </h3>
                    </div>
                    {isDisplaySelected && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                        Locked
                      </span>
                    )}
                  </div>
                  {displayNode ? (
                    <div className="space-y-3 text-sm">
                      <p className="font-mono text-xs text-gray-700 break-all bg-gray-50 p-2 rounded">
                        {displayNode.address}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-xs">Risk Score</label>
                          <RiskBadge score={displayNode.riskScore} size="sm" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs">Distance</label>
                          <p className="font-semibold">
                            {displayNode.distance} hop{displayNode.distance !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {displayNodeEdgeInfo && (
                          <>
                            <div>
                              <label className="text-gray-500 text-xs">Direction</label>
                              <p className="font-semibold capitalize">
                                {displayNodeEdgeInfo.direction || "N/A"}
                              </p>
                            </div>
                            <div>
                              <label className="text-gray-500 text-xs">Transfers</label>
                              <p className="font-semibold">{displayNodeEdgeInfo.totalTransfers}</p>
                            </div>
                          </>
                        )}
                      </div>
                      {displayNode.tags && displayNode.tags.length > 0 && (
                        <div>
                          <label className="text-gray-500 text-xs block mb-1">Tags</label>
                          <div className="flex flex-wrap gap-1">
                            {displayNode.tags.slice(0, 4).map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleNodeDoubleClick(displayNode.address || "")}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-100 text-purple-700 text-xs font-medium rounded hover:bg-purple-200 transition-colors"
                        >
                          <Network className="w-3 h-3" />
                          Explore
                        </button>
                        <Link
                          to={`/address?q=${displayNode.address}`}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Details
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
              <p className="text-gray-500 mt-2">
                Enter an Ethereum address to visualize its transaction network
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
