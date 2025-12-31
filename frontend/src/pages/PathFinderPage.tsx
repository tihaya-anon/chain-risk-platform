import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Network, DataSet, Options } from 'vis-network/standalone'
import {
  Route,
  Search,
  ArrowLeftRight,
  Circle,
  Tag,
  AlertCircle,
} from 'lucide-react'
import { Button, Input, Card, LoadingSpinner, RiskBadge } from '@/components/common'
import { orchestrationService } from '@/services'

export function PathFinderPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)

  // Sync with URL
  const urlFrom = searchParams.get('from') || ''
  const urlTo = searchParams.get('to') || ''

  const [fromAddress, setFromAddress] = useState(urlFrom)
  const [toAddress, setToAddress] = useState(urlTo)
  const [maxDepth, setMaxDepth] = useState(5)
  const [queryParams, setQueryParams] = useState<{
    from: string
    to: string
    maxDepth: number
  } | null>(null)

  // Sync with URL changes
  useEffect(() => {
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    if (from !== fromAddress) setFromAddress(from)
    if (to !== toAddress) setToAddress(to)
  }, [searchParams])

  // Fetch connection data
  const connectionQuery = useQuery({
    queryKey: ['connection', queryParams?.from, queryParams?.to, queryParams?.maxDepth],
    queryFn: () =>
      orchestrationService.findConnection(
        queryParams!.from,
        queryParams!.to,
        { maxDepth: queryParams!.maxDepth }
      ),
    enabled: !!queryParams,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (fromAddress.trim() && toAddress.trim()) {
      const from = fromAddress.trim().toLowerCase()
      const to = toAddress.trim().toLowerCase()
      setQueryParams({ from, to, maxDepth })
      setSearchParams({ from, to })
    }
  }

  const handleSwap = () => {
    const temp = fromAddress
    setFromAddress(toAddress)
    setToAddress(temp)
  }

  // Render path visualization
  useEffect(() => {
    if (!containerRef.current || !connectionQuery.data?.path?.found) return

    const pathData = connectionQuery.data.path

    // Build nodes and edges
    const nodes: Array<{
      id: string
      label: string
      color: { background: string; border: string }
      size: number
      font?: { color: string }
      borderWidth: number
    }> = []
    const edges: Array<{
      id: string
      from: string
      to: string
      arrows: string
      label?: string
      color: { color: string }
      width: number
    }> = []

    pathData.path.forEach((node, index) => {
      const isStart = index === 0
      const isEnd = index === pathData.path.length - 1

      let bgColor = '#9CA3AF'
      let borderColor = '#6B7280'

      if (isStart) {
        bgColor = '#3B82F6'
        borderColor = '#1D4ED8'
      } else if (isEnd) {
        bgColor = '#8B5CF6'
        borderColor = '#6D28D9'
      } else if (node.riskScore !== undefined) {
        if (node.riskScore >= 0.8) {
          bgColor = '#DC2626'
          borderColor = '#991B1B'
        } else if (node.riskScore >= 0.6) {
          bgColor = '#EA580C'
          borderColor = '#9A3412'
        } else if (node.riskScore >= 0.4) {
          bgColor = '#CA8A04'
          borderColor = '#854D0E'
        } else {
          bgColor = '#16A34A'
          borderColor = '#15803D'
        }
      }

      nodes.push({
        id: node.address,
        label: `${node.address.slice(0, 6)}...${node.address.slice(-4)}${
          isStart ? '\n(Source)' : isEnd ? '\n(Target)' : ''
        }`,
        color: { background: bgColor, border: borderColor },
        size: isStart || isEnd ? 30 : 20,
        font: isStart || isEnd ? { color: '#FFFFFF' } : undefined,
        borderWidth: isStart || isEnd ? 3 : 2,
      })

      if (index < pathData.path.length - 1) {
        const nextNode = pathData.path[index + 1]
        edges.push({
          id: `edge-${index}`,
          from: node.address,
          to: nextNode.address,
          arrows: 'to',
          label: node.value ? formatValue(node.value) : undefined,
          color: { color: '#6B7280' },
          width: 2,
        })
      }
    })

    const nodesDataSet = new DataSet(nodes)
    const edgesDataSet = new DataSet(edges)

    const options: Options = {
      nodes: {
        shape: 'dot',
        font: { size: 12, color: '#374151' },
        borderWidth: 2,
        shadow: true,
      },
      edges: {
        smooth: { enabled: true, type: 'curvedCW', roundness: 0.2 },
        shadow: true,
        font: { size: 10, align: 'middle' },
      },
      physics: {
        enabled: true,
        solver: 'hierarchicalRepulsion',
        hierarchicalRepulsion: {
          nodeDistance: 150,
          springLength: 150,
        },
        stabilization: { iterations: 50 },
      },
      layout: {
        hierarchical: {
          enabled: true,
          direction: 'LR',
          sortMethod: 'directed',
          levelSeparation: 200,
          nodeSpacing: 100,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
      },
    }

    const network = new Network(
      containerRef.current,
      { nodes: nodesDataSet, edges: edgesDataSet },
      options
    )

    network.on('stabilizationIterationsDone', () => {
      network.setOptions({ physics: { enabled: false } })
    })

    networkRef.current = network

    return () => {
      network.destroy()
      networkRef.current = null
    }
  }, [connectionQuery.data])

  const connection = connectionQuery.data
  const pathFound = connection?.path?.found

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header with Search Form */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Title */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Route className="w-6 h-6 text-blue-600" />
              Path Finder
            </h1>
            <p className="text-gray-600 mt-1">
              Find the shortest transaction path between two addresses
            </p>
          </div>

          {/* Search Form */}
          <Card>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Address
                  </label>
                  <Input
                    placeholder="0x..."
                    value={fromAddress}
                    onChange={(e) => setFromAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Address
                  </label>
                  <Input
                    placeholder="0x..."
                    value={toAddress}
                    onChange={(e) => setToAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Max Depth:</label>
                  <select
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                  >
                    <option value={3}>3 hops</option>
                    <option value={5}>5 hops</option>
                    <option value={7}>7 hops</option>
                    <option value={10}>10 hops</option>
                  </select>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSwap}
                >
                  <ArrowLeftRight className="w-4 h-4 mr-1" />
                  Swap
                </Button>
                <Button type="submit" loading={connectionQuery.isLoading}>
                  <Search className="w-4 h-4 mr-1" />
                  Find Path
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Loading */}
          {connectionQuery.isLoading && (
            <div className="py-12">
              <LoadingSpinner size="lg" />
              <p className="text-center text-gray-500 mt-4">
                Searching for connection path...
              </p>
            </div>
          )}

          {/* Results */}
          {connection && !connectionQuery.isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Path Visualization */}
              <div className="lg:col-span-2">
                <Card
                  title={pathFound ? 'Connection Path' : 'No Path Found'}
                  subtitle={
                    pathFound
                      ? `${connection.path.pathLength} hops between addresses`
                      : `No connection within ${connection.path.maxDepth} hops`
                  }
                >
                  {pathFound ? (
                    <>
                      <div
                        ref={containerRef}
                        style={{ height: '400px', width: '100%' }}
                        className="border border-gray-200 rounded-lg bg-gray-50"
                      />
                      <div className="mt-4 flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4 fill-blue-500 text-blue-500" />
                          <span>Source</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4 fill-purple-500 text-purple-500" />
                          <span>Target</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4 fill-green-500 text-green-500" />
                          <span>Low Risk</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4 fill-red-500 text-red-500" />
                          <span>High Risk</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <AlertCircle className="w-16 h-16 text-gray-300 mx-auto" />
                      <p className="text-gray-500 mt-4">
                        {connection.path.message ||
                          'No direct or indirect connection found'}
                      </p>
                      <p className="text-sm text-gray-400 mt-2">
                        Try increasing the max depth or check if the addresses are
                        correct
                      </p>
                    </div>
                  )}
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Source Risk */}
                <Card title="Source Address Risk">
                  {'error' in connection.fromAddressRisk ? (
                    <p className="text-gray-500 text-sm">Risk data unavailable</p>
                  ) : (
                    <RiskInfoCard risk={connection.fromAddressRisk} />
                  )}
                </Card>

                {/* Target Risk */}
                <Card title="Target Address Risk">
                  {'error' in connection.toAddressRisk ? (
                    <p className="text-gray-500 text-sm">Risk data unavailable</p>
                  ) : (
                    <RiskInfoCard risk={connection.toAddressRisk} />
                  )}
                </Card>

                {/* Path Details */}
                {pathFound && (
                  <Card title="Path Details">
                    <div className="space-y-3">
                      {connection.path.path.map((node, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                        >
                          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full text-xs font-medium">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs truncate">
                              {node.address}
                            </p>
                            {node.tags && node.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {node.tags.slice(0, 2).map((tag, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                                  >
                                    <Tag className="w-3 h-3" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {node.riskScore !== undefined && (
                            <span
                              className={`px-2 py-0.5 text-xs rounded ${
                                node.riskScore >= 0.6
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {node.riskScore.toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!connectionQuery.isLoading && !connection && (
            <div className="text-center py-12">
              <Route className="w-16 h-16 text-gray-300 mx-auto" />
              <p className="text-gray-500 mt-4">
                Enter two addresses to find the connection path between them
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper component for risk info
function RiskInfoCard({
  risk,
}: {
  risk: { riskScore: number; riskLevel: string; tags?: string[] }
}) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <div className="text-3xl font-bold">{risk.riskScore.toFixed(2)}</div>
        <RiskBadge level={risk.riskLevel as 'low' | 'medium' | 'high' | 'critical'} />
      </div>
      {risk.tags && risk.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">
          {risk.tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded"
            >
              <Tag className="w-3 h-3" />
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Helper function
function formatValue(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  if (num >= 1e18) return `${(num / 1e18).toFixed(2)} ETH`
  return value
}
