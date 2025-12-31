import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import {
  Network,
  Search,
  RefreshCw,
  ExternalLink,
  Route,
  Tag,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  MousePointer,
  MousePointerClick,
} from "lucide-react"
import { Button, Input, Card, LoadingSpinner } from "@/components/common"
import { AddressGraph, GraphLegend } from "@/components/graph"
import type { HoveredNodeInfo } from "@/components/graph/AddressGraph"
import { graphService } from "@/services"

export function GraphExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // Get address from URL
  const urlAddress = searchParams.get("address") || ""

  const [searchAddress, setSearchAddress] = useState(urlAddress)
  const [currentAddress, setCurrentAddress] = useState(urlAddress)
  const [depth, setDepth] = useState(1)
  const [limit, setLimit] = useState(30)
  const [hoveredNode, setHoveredNode] = useState<HoveredNodeInfo | null>(null)
  const [selectedNode, setSelectedNode] = useState<HoveredNodeInfo | null>(null)

  // Sync with URL changes (fixes the navigation issue)
  useEffect(() => {
    const addressFromUrl = searchParams.get("address") || ""
    if (addressFromUrl && addressFromUrl !== currentAddress) {
      setSearchAddress(addressFromUrl)
      setCurrentAddress(addressFromUrl)
      // Clear selection when navigating to new address
      setSelectedNode(null)
      setHoveredNode(null)
    }
  }, [searchParams, currentAddress])

  // Update URL when address changes
  const updateUrl = useCallback(
    (address: string) => {
      if (address) {
        setSearchParams({ address })
      }
    },
    [setSearchParams]
  )

  // Fetch address info
  const addressInfoQuery = useQuery({
    queryKey: ["graphAddressInfo", currentAddress],
    queryFn: () => graphService.getAddressInfo(currentAddress),
    enabled: !!currentAddress,
  })

  // Fetch neighbors
  const neighborsQuery = useQuery({
    queryKey: ["graphNeighbors", currentAddress, depth, limit],
    queryFn: () => graphService.getAddressNeighbors(currentAddress, depth, limit),
    enabled: !!currentAddress,
  })

  // Add tag mutation
  const addTagMutation = useMutation({
    mutationFn: ({ address, tags }: { address: string; tags: string[] }) =>
      graphService.addAddressTags(address, { tags }),
    onSuccess: () => {
      addressInfoQuery.refetch()
    },
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchAddress.trim()) {
      const normalized = searchAddress.trim().toLowerCase()
      setCurrentAddress(normalized)
      updateUrl(normalized)
    }
  }

  const handleNodeDoubleClick = (address: string) => {
    setSearchAddress(address)
    setCurrentAddress(address)
    updateUrl(address)
  }

  const handleNodeHover = (info: HoveredNodeInfo | null) => {
    setHoveredNode(info)
  }

  const handleNodeSelect = (info: HoveredNodeInfo | null) => {
    setSelectedNode(info)
    // Clear hover when selecting
    if (info) {
      setHoveredNode(null)
    }
  }

  const handleAddTag = () => {
    const tag = prompt("Enter tag to add:")
    if (tag && currentAddress) {
      addTagMutation.mutate({ address: currentAddress, tags: [tag] })
    }
  }

  const isLoading = addressInfoQuery.isLoading || neighborsQuery.isLoading
  const addressInfo = addressInfoQuery.data
  const neighbors = neighborsQuery.data

  // Display node is either selected (priority) or hovered
  const displayNode = selectedNode || hoveredNode
  const isSelected = !!selectedNode

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Title */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Network className="w-6 h-6 text-blue-600" />
              Graph Explorer
            </h1>
            <p className="text-gray-600 mt-1">
              Visualize address relationships and transaction flows
            </p>
          </div>

          {/* Search and Controls */}
          <Card>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Enter Ethereum address (0x...)"
                    value={searchAddress}
                    onChange={(e) => setSearchAddress(e.target.value)}
                  />
                </div>
                <Button type="submit" loading={isLoading}>
                  <Search className="w-4 h-4 mr-1" />
                  Explore
                </Button>
              </div>

              {/* Graph Controls */}
              <div className="flex flex-wrap gap-4 items-center pt-4 border-t">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Depth:</label>
                  <select
                    value={depth}
                    onChange={(e) => setDepth(Number(e.target.value))}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                  >
                    <option value={1}>1 hop</option>
                    <option value={2}>2 hops</option>
                    <option value={3}>3 hops</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Max Neighbors:</label>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                {currentAddress && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => neighborsQuery.refetch()}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Loading */}
          {isLoading && (
            <div className="py-12">
              <LoadingSpinner size="lg" />
              <p className="text-center text-gray-500 mt-4">Loading graph data...</p>
            </div>
          )}

          {/* Graph and Info */}
          {!isLoading && currentAddress && neighbors && (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* Graph */}
              <div className="xl:col-span-3">
                <Card
                  title="Address Graph"
                  subtitle="Click to select, double-click to explore"
                >
                  <div className="mb-4">
                    <GraphLegend />
                  </div>
                  <AddressGraph
                    centerAddress={currentAddress}
                    neighbors={neighbors.neighbors}
                    selectedNode={selectedNode?.address}
                    onNodeSelect={handleNodeSelect}
                    onNodeHover={handleNodeHover}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    height="600px"
                  />
                  <div className="mt-4 text-sm text-gray-500">
                    Showing {neighbors.neighbors.length} of {neighbors.totalCount}{" "}
                    connected addresses
                  </div>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Selected/Hovered Node Info */}
                <Card
                  title={isSelected ? "Selected Node" : "Hovered Node"}
                  className={isSelected ? "ring-2 ring-blue-500" : ""}
                >
                  {displayNode ? (
                    <div className="space-y-3">
                      {isSelected && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleNodeSelect(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 underline"
                          >
                            Clear selection
                          </button>
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-gray-500">Address</label>
                        <p className="font-mono text-xs break-all">
                          {displayNode.address}
                        </p>
                      </div>
                      {displayNode.isCenter ? (
                        <div className="py-2 px-3 bg-blue-50 rounded-lg text-center">
                          <span className="text-sm text-blue-700 font-medium">
                            Center Address
                          </span>
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
                              <p className="font-medium">
                                {displayNode.transferCount || 0}
                              </p>
                            </div>
                          </div>
                          {displayNode.direction && (
                            <div>
                              <label className="text-xs text-gray-500">Direction</label>
                              <div className="flex items-center gap-2 mt-1">
                                {displayNode.direction === "incoming" && (
                                  <>
                                    <ArrowDownLeft className="w-4 h-4 text-green-600" />
                                    <span className="text-sm text-green-600">
                                      Incoming
                                    </span>
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
                                    <span className="text-sm text-gray-600">
                                      Bidirectional
                                    </span>
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

                {/* Center Address Info */}
                <Card title="Center Address">
                  {addressInfo ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500">Address</label>
                        <p className="font-mono text-xs break-all">
                          {addressInfo.address}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Risk Score</label>
                          <p className="font-medium">
                            {addressInfo.riskScore?.toFixed(2) || "N/A"}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">TX Count</label>
                          <p className="font-medium">{addressInfo.txCount}</p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Incoming</label>
                          <p className="font-medium text-green-600">
                            {addressInfo.incomingCount}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Outgoing</label>
                          <p className="font-medium text-red-600">
                            {addressInfo.outgoingCount}
                          </p>
                        </div>
                      </div>
                      {addressInfo.clusterId && (
                        <div>
                          <label className="text-xs text-gray-500">Cluster</label>
                          <p className="font-mono text-xs truncate">
                            {addressInfo.clusterId}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No info available</p>
                  )}
                </Card>

                {/* Tags */}
                <Card title="Tags">
                  {addressInfo?.tags && addressInfo.tags.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {addressInfo.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                          >
                            <Tag className="w-3 h-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleAddTag}
                        loading={addTagMutation.isPending}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Tag
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-gray-500 text-sm">No tags</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleAddTag}
                        loading={addTagMutation.isPending}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Tag
                      </Button>
                    </div>
                  )}
                </Card>

                {/* Quick Actions */}
                <Card title="Actions">
                  <div className="space-y-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => navigate(`/address?q=${currentAddress}`)}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Full Analysis
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => navigate(`/path-finder?from=${currentAddress}`)}
                    >
                      <Route className="w-4 h-4 mr-2" />
                      Find Paths
                    </Button>
                  </div>
                </Card>

                {/* Top Neighbors */}
                <Card title="Top Neighbors" subtitle="By transfer count">
                  {neighbors.neighbors.length > 0 ? (
                    <div className="space-y-2">
                      {neighbors.neighbors.slice(0, 5).map((neighbor, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                          onClick={() => handleNodeDoubleClick(neighbor.address)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs truncate">
                              {neighbor.address.slice(0, 10)}...
                            </p>
                            <p className="text-xs text-gray-500">
                              {neighbor.transferCount} transfers
                            </p>
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
                  ) : (
                    <p className="text-gray-500 text-sm">No neighbors found</p>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !currentAddress && (
            <div className="text-center py-12">
              <Network className="w-16 h-16 text-gray-300 mx-auto" />
              <p className="text-gray-500 mt-4">
                Enter an address to explore its transaction graph
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
