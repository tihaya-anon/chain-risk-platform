import { useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { Route, Search, ArrowRight } from "lucide-react"
import { Card, Button, Input, LoadingSpinner, RiskBadge } from "@/components/common"
import { useFindConnection } from "@/api/generated"

export function PathFinderPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [fromAddress, setFromAddress] = useState(searchParams.get("from") || "")
  const [toAddress, setToAddress] = useState(searchParams.get("to") || "")
  const [queryFrom, setQueryFrom] = useState("")
  const [queryTo, setQueryTo] = useState("")

  const connectionQuery = useFindConnection(queryFrom, queryTo, { maxDepth: 5 }, {
    query: { enabled: !!(queryFrom && queryTo) }
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (fromAddress.trim() && toAddress.trim()) {
      const from = fromAddress.trim().toLowerCase()
      const to = toAddress.trim().toLowerCase()
      setQueryFrom(from)
      setQueryTo(to)
      setSearchParams({ from, to })
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Route className="w-6 h-6 text-green-600" />
              Path Finder
            </h1>
            <p className="text-gray-600 mt-1">Find connections between two addresses</p>
          </div>

          <Card>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="From Address"
                  placeholder="0x..."
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                />
                <Input
                  label="To Address"
                  placeholder="0x..."
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                />
              </div>
              <Button type="submit" loading={connectionQuery.isLoading}>
                <Search className="w-4 h-4 mr-1" />
                Find Path
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {connectionQuery.isLoading && (
            <div className="py-12">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {connectionQuery.data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Source Address">
                  <div className="space-y-2">
                    <p className="font-mono text-sm break-all">{connectionQuery.data.fromAddress}</p>
                    {connectionQuery.data.fromAddressRisk && (
                      <RiskBadge score={connectionQuery.data.fromAddressRisk.riskScore} />
                    )}
                    <Link to={`/address?q=${connectionQuery.data.fromAddress}`} className="text-blue-600 text-sm hover:underline">
                      View Details →
                    </Link>
                  </div>
                </Card>
                <Card title="Target Address">
                  <div className="space-y-2">
                    <p className="font-mono text-sm break-all">{connectionQuery.data.toAddress}</p>
                    {connectionQuery.data.toAddressRisk && (
                      <RiskBadge score={connectionQuery.data.toAddressRisk.riskScore} />
                    )}
                    <Link to={`/address?q=${connectionQuery.data.toAddress}`} className="text-blue-600 text-sm hover:underline">
                      View Details →
                    </Link>
                  </div>
                </Card>
              </div>

              <Card title="Path Result">
                {connectionQuery.data.path?.found ? (
                  <div className="space-y-4">
                    <p className="text-green-600 font-medium">
                      Path found! Length: {connectionQuery.data.path.pathLength} hops
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {connectionQuery.data.path.path?.map((node, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Link
                            to={`/address?q=${node.address}`}
                            className="px-3 py-2 bg-gray-100 rounded-lg font-mono text-xs hover:bg-gray-200"
                          >
                            {node.address?.slice(0, 8)}...
                          </Link>
                          {i < (connectionQuery.data.path?.path?.length || 0) - 1 && (
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">No path found within max depth</p>
                )}
              </Card>
            </div>
          )}

          {!connectionQuery.isLoading && !connectionQuery.data && (
            <div className="text-center py-12">
              <Route className="w-16 h-16 text-gray-300 mx-auto" />
              <p className="text-gray-500 mt-4">Enter two addresses to find a connection</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
