import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Tag,
  Search,
  ExternalLink,
  Network,
  Filter,
  X,
} from "lucide-react"
import { Button, Card, Input, LoadingSpinner, RiskBadge } from "@/components/common"
import { graphService } from "@/services"

// Common tags for quick selection
const COMMON_TAGS = [
  "exchange",
  "defi",
  "mixer",
  "bridge",
  "whale",
  "miner",
  "contract",
  "scam",
  "phishing",
  "hack",
  "nft",
  "dao",
]

export function TagSearchPage() {
  const [searchTag, setSearchTag] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [limit, setLimit] = useState(50)

  // Search query
  const searchQuery = useQuery({
    queryKey: ["tagSearch", activeTag, limit],
    queryFn: () => graphService.searchByTag(activeTag!, limit),
    enabled: !!activeTag,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTag.trim()) {
      setActiveTag(searchTag.trim().toLowerCase())
    }
  }

  const handleTagClick = (tag: string) => {
    setSearchTag(tag)
    setActiveTag(tag)
  }

  const clearSearch = () => {
    setSearchTag("")
    setActiveTag(null)
  }

  const addresses = searchQuery.data || []

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Tag className="w-6 h-6 text-blue-600" />
              Tag Search
            </h1>
            <p className="text-gray-600 mt-1">
              Search for addresses by their associated tags
            </p>
          </div>

          {/* Search Form */}
          <Card>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Enter tag to search (e.g., exchange, mixer, scam)"
                    value={searchTag}
                    onChange={(e) => setSearchTag(e.target.value)}
                  />
                  {searchTag && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value={20}>20 results</option>
                    <option value={50}>50 results</option>
                    <option value={100}>100 results</option>
                  </select>
                </div>
                <Button type="submit" loading={searchQuery.isLoading}>
                  <Search className="w-4 h-4 mr-1" />
                  Search
                </Button>
              </div>

              {/* Quick Tags */}
              <div>
                <p className="text-sm text-gray-500 mb-2">Quick search:</p>
                <div className="flex flex-wrap gap-2">
                  {COMMON_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagClick(tag)}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        activeTag === tag
                          ? "bg-blue-100 border-blue-300 text-blue-700"
                          : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Loading */}
          {searchQuery.isLoading && (
            <div className="py-12">
              <LoadingSpinner size="lg" />
              <p className="text-center text-gray-500 mt-4">
                Searching for addresses with tag "{activeTag}"...
              </p>
            </div>
          )}

          {/* Results */}
          {!searchQuery.isLoading && activeTag && (
            <Card
              title={`Results for "${activeTag}"`}
              subtitle={`Found ${addresses.length} addresses`}
            >
              {addresses.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No addresses found with tag "{activeTag}"
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Address
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Risk Score
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          All Tags
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Transactions
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Cluster
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {addresses.map((addr) => (
                        <tr key={addr.address} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link
                              to={`/address?q=${addr.address}`}
                              className="font-mono text-sm text-blue-600 hover:underline"
                            >
                              {addr.address.slice(0, 10)}...{addr.address.slice(-8)}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <RiskBadge score={addr.riskScore} size="sm" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {addr.tags.map((tag) => (
                                <button
                                  key={tag}
                                  onClick={() => handleTagClick(tag)}
                                  className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                                    tag === activeTag
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  }`}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {addr.txCount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {addr.clusterId ? (
                              <span className="text-purple-600 font-mono text-xs">
                                {addr.clusterId}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                to={`/address?q=${addr.address}`}
                                className="p-1 text-gray-400 hover:text-blue-600"
                                title="View Details"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                              <Link
                                to={`/graph?address=${addr.address}`}
                                className="p-1 text-gray-400 hover:text-green-600"
                                title="View in Graph"
                              >
                                <Network className="w-4 h-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Empty State */}
          {!searchQuery.isLoading && !activeTag && (
            <div className="text-center py-12">
              <Tag className="w-16 h-16 text-gray-300 mx-auto" />
              <p className="text-gray-500 mt-4">
                Enter a tag or click a quick search tag to find addresses
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
