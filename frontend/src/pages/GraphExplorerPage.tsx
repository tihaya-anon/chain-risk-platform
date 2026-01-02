import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Network,
  Search,
  RefreshCw,
  ExternalLink,
  Route,
  Tag,
  Plus,
  Zap,
  Trash2,
} from "lucide-react"
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
import { Select } from "@/components/common/Select"

export function GraphExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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

  // Mutations
  const addTagMutation = useMutation({
    mutationFn: ({ address, tags }: { address: string; tags: string[] }) =>
      graphService.addAddressTags(address, { tags }),
    onSuccess: () => {
      addressInfoQuery.refetch()
      queryClient.invalidateQueries({ queryKey: ["graphNeighbors"] })
    },
  })

  const removeTagMutation = useMutation({
    mutationFn: ({ address, tag }: { address: string; tag: string }) =>
      graphService.removeAddressTag(address, tag),
    onSuccess: () => {
      addressInfoQuery.refetch()
      queryClient.invalidateQueries({ queryKey: ["graphNeighbors"] })
    },
  })

  const propagateFromAddressMutation = useMutation({
    mutationFn: (address: string) => graphService.propagateFromAddress(address),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graphNeighbors"] })
      queryClient.invalidateQueries({ queryKey: ["graphAddressInfo"] })
    },
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
      addTagMutation.mutate({ address: currentAddress, tags: [tag.trim().toLowerCase()] })
    }
  }

  const handleRemoveTag = (tag: string) => {
    if (currentAddress && confirm(`Remove tag "${tag}"?`)) {
      removeTagMutation.mutate({ address: currentAddress, tag })
    }
  }

  const handlePropagate = () => {
    if (
      currentAddress &&
      confirm(
        "Propagate risk tags from this address to its neighbors?\n\nThis will spread risk scores with decay to connected addresses."
      )
    ) {
      propagateFromAddressMutation.mutate(currentAddress)
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
                  <Select
                    value={depth}
                    onChange={(e) => setDepth(Number(e.target.value))}
                    options={[
                      [1, '1 hop'],
                      [2, '2 hops'],
                      [3, '3 hops']
                    ]}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Max Neighbors:</label>
                  <Select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    options={[
                      [10, '10'],
                      [30, '30'],
                      [50, '50'],
                      [100, '100']
                    ]}
                  />
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
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {addressInfo.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full group"
                          >
                            <Tag className="w-3 h-3" />
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-1 p-0.5 rounded-full hover:bg-blue-200 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove tag"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleAddTag}
                          loading={addTagMutation.isPending}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handlePropagate}
                          loading={propagateFromAddressMutation.isPending}
                          title="Propagate tags to neighbors"
                        >
                          <Zap className="w-4 h-4 mr-1" />
                          Propagate
                        </Button>
                      </div>
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

                  {/* Propagation Result */}
                  {propagateFromAddressMutation.data && (
                    <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                      <p className="font-medium">Propagation complete</p>
                      <p>
                        {propagateFromAddressMutation.data.addressesAffected} addresses
                        affected
                      </p>
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
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => navigate(`/tags`)}
                    >
                      <Tag className="w-4 h-4 mr-2" />
                      Search by Tag
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
