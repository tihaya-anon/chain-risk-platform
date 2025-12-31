import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button, Input, Card, LoadingSpinner } from '@/components/common'
import { AddressGraph, GraphLegend } from '@/components/graph'
import { graphService } from '@/services'

export function GraphExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [searchAddress, setSearchAddress] = useState(
    searchParams.get('address') || ''
  )
  const [currentAddress, setCurrentAddress] = useState(
    searchParams.get('address') || ''
  )
  const [depth, setDepth] = useState(1)
  const [limit, setLimit] = useState(30)

  // Update URL when address changes
  useEffect(() => {
    if (currentAddress) {
      setSearchParams({ address: currentAddress })
    }
  }, [currentAddress, setSearchParams])

  // Fetch address info
  const addressInfoQuery = useQuery({
    queryKey: ['graphAddressInfo', currentAddress],
    queryFn: () => graphService.getAddressInfo(currentAddress),
    enabled: !!currentAddress,
  })

  // Fetch neighbors
  const neighborsQuery = useQuery({
    queryKey: ['graphNeighbors', currentAddress, depth, limit],
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
      setCurrentAddress(searchAddress.trim().toLowerCase())
    }
  }

  const handleNodeClick = (address: string) => {
    // Could show a tooltip or sidebar with address info
    console.log('Node clicked:', address)
  }

  const handleNodeDoubleClick = (address: string) => {
    // Navigate to that address
    setSearchAddress(address)
    setCurrentAddress(address)
  }

  const handleAddTag = () => {
    const tag = prompt('Enter tag to add:')
    if (tag && currentAddress) {
      addTagMutation.mutate({ address: currentAddress, tags: [tag] })
    }
  }

  const isLoading = addressInfoQuery.isLoading || neighborsQuery.isLoading
  const addressInfo = addressInfoQuery.data
  const neighbors = neighborsQuery.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Graph Explorer</h1>
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
                Refresh
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="py-12">
          <LoadingSpinner size="lg" />
          <p className="text-center text-gray-500 mt-4">
            Loading graph data...
          </p>
        </div>
      )}

      {/* Graph and Info */}
      {!isLoading && currentAddress && neighbors && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Graph */}
          <div className="xl:col-span-3">
            <Card title="Address Graph" subtitle="Double-click a node to explore it">
              <div className="mb-4">
                <GraphLegend />
              </div>
              <AddressGraph
                centerAddress={currentAddress}
                neighbors={neighbors.neighbors}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                height="600px"
              />
              <div className="mt-4 text-sm text-gray-500">
                Showing {neighbors.neighbors.length} of {neighbors.totalCount}{' '}
                connected addresses
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Address Info */}
            <Card title="Address Info">
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
                        {addressInfo.riskScore?.toFixed(2) || 'N/A'}
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
                        className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                      >
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
                    + Add Tag
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
                    + Add Tag
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
                  className="w-full"
                  onClick={() => navigate(`/address?q=${currentAddress}`)}
                >
                  📊 Full Analysis
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/path-finder?from=${currentAddress}`)}
                >
                  🔍 Find Paths
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
                        <span
                          className={`text-xs ${neighbor.direction === 'incoming'
                            ? 'text-green-600'
                            : neighbor.direction === 'outgoing'
                              ? 'text-red-600'
                              : 'text-gray-600'
                            }`}
                        >
                          {neighbor.direction === 'incoming' && '←'}
                          {neighbor.direction === 'outgoing' && '→'}
                          {neighbor.direction === 'both' && '↔'}
                        </span>
                        {neighbor.riskScore !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 text-xs rounded ${neighbor.riskScore >= 0.6
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
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
          <span className="text-6xl">🔗</span>
          <p className="text-gray-500 mt-4">
            Enter an address to explore its transaction graph
          </p>
        </div>
      )}
    </div>
  )
}
