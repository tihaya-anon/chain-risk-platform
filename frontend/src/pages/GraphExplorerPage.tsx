import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Network, Search, RefreshCw, ExternalLink, Route, Tag, Plus } from "lucide-react"
import { Button, Input, Card, LoadingSpinner } from "@/components/common"
import {
  AddressGraph,
  GraphLegend,
  NodeInfoPanel,
  CenterAddressInfo,
  TopNeighborsList,
} from "@/components/graph"
import type { HoveredNodeInfo } from "@/components/graph/AddressGraph"
import { graphService } from "@/services"

export function GraphExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const urlAddress = searchParams.get("address") || ""

  const [searchAddress, setSearchAddress] = useState(urlAddress)
  const [currentAddress, setCurrentAddress] = useState(urlAddress)
  const [depth, setDepth] = useState(1)
  const [limit, setLimit] = useState(30)
  const [hoveredNode, setHoveredNode] = useState<HoveredNodeInfo | null>(null)
  const [selectedNode, setSelectedNode] = useState<HoveredNodeInfo | null>(null)

  // Sync with URL changes
  useEffect(() => {
    const addressFromUrl = searchParams.get("address") || ""
    if (addressFromUrl && addressFromUrl !== currentAddress) {
      setSearchAddress(addressFromUrl)
      setCurrentAddress(addressFromUrl)
      setSelectedNode(null)
      setHoveredNode(null)
    }
  }, [searchParams, currentAddress])

  const updateUrl = useCallback(
    (address: string) => {
      if (address) {
        setSearchParams({ address })
      }
    },
    [setSearchParams]
  )

  // Queries
  const addressInfoQuery = useQuery({
    queryKey: ["graphAddressInfo", currentAddress],
    queryFn: () => graphService.getAddressInfo(currentAddress),
    enabled: !!currentAddress,
  })

  const neighborsQuery = useQuery({
    queryKey: ["graphNeighbors", currentAddress, depth, limit],
    queryFn: () => graphService.getAddressNeighbors(currentAddress, depth, limit),
    enabled: !!currentAddress,
  })

  const addTagMutation = useMutation({
    mutationFn: ({ address, tags }: { address: string; tags: string[] }) =>
      graphService.addAddressTags(address, { tags }),
    onSuccess: () => addressInfoQuery.refetch(),
  })

  // Handlers
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

  const handleNodeSelect = (info: HoveredNodeInfo | null) => {
    setSelectedNode(info)
    if (info) setHoveredNode(null)
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
  const displayNode = selectedNode || hoveredNode
  const isSelected = !!selectedNode

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Network className="w-6 h-6 text-blue-600" />
              Graph Explorer
            </h1>
            <p className="text-gray-600 mt-1">
              Visualize address relationships and transaction flows
            </p>
          </div>

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
          {isLoading && (
            <div className="py-12">
              <LoadingSpinner size="lg" />
              <p className="text-center text-gray-500 mt-4">Loading graph data...</p>
            </div>
          )}

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
                    onNodeHover={setHoveredNode}
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
                <NodeInfoPanel
                  displayNode={displayNode}
                  isSelected={isSelected}
                  onClearSelection={() => handleNodeSelect(null)}
                />

                <CenterAddressInfo addressInfo={addressInfo || null} />

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

                {/* Actions */}
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

                <TopNeighborsList
                  neighbors={neighbors.neighbors}
                  onNavigate={handleNodeDoubleClick}
                />
              </div>
            </div>
          )}

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
