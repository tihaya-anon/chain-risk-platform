import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  AlertTriangle,
  Search,
  Shield,
  CheckCircle,
  XCircle,
  Scale,
  Tag,
  ExternalLink,
} from "lucide-react"
import { Button, Card, LoadingSpinner, RiskBadge } from "@/components/common"
import { riskService } from "@/services"
import type { RiskScore, RiskRule } from "@/types"

export function RiskPage() {
  const [addresses, setAddresses] = useState("")
  const [results, setResults] = useState<RiskScore[]>([])

  const rulesQuery = useQuery({
    queryKey: ["riskRules"],
    queryFn: riskService.listRules,
  })

  const batchMutation = useMutation({
    mutationFn: riskService.scoreAddressesBatch,
    onSuccess: (data) => {
      setResults(data.results)
    },
  })

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault()
    const addressList = addresses
      .split("\n")
      .map((a) => a.trim())
      .filter((a) => a.length > 0)

    if (addressList.length > 0) {
      batchMutation.mutate({
        addresses: addressList,
        includeFactors: true,
      })
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header with Input Form and Rules */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Title */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
              Risk Analysis
            </h1>
            <p className="text-gray-600 mt-1">
              Batch analyze addresses for risk assessment
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Form */}
            <Card title="Batch Analysis" className="lg:col-span-2">
              <form onSubmit={handleAnalyze} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Addresses (one per line, max 100)
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={4}
                    placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f1b7E0&#10;0x1234567890abcdef1234567890abcdef12345678&#10;..."
                    value={addresses}
                    onChange={(e) => setAddresses(e.target.value)}
                  />
                </div>
                <Button type="submit" loading={batchMutation.isPending}>
                  <Search className="w-4 h-4 mr-1" />
                  Analyze Addresses
                </Button>
              </form>
            </Card>

            {/* Risk Rules */}
            <Card title="Active Rules">
              {rulesQuery.isLoading ? (
                <LoadingSpinner />
              ) : rulesQuery.data ? (
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                  {rulesQuery.data.map((rule: RiskRule, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{rule.name}</p>
                          <p className="text-xs text-gray-500">{rule.description}</p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-600 flex items-center gap-1 flex-shrink-0 ml-2">
                        <Scale className="w-3 h-3" />
                        {rule.weight.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Failed to load rules</p>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Scrollable Results */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Loading */}
          {batchMutation.isPending && (
            <div className="py-12">
              <LoadingSpinner size="lg" />
              <p className="text-center text-gray-500 mt-4">Analyzing addresses...</p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && !batchMutation.isPending && (
            <Card
              title="Analysis Results"
              subtitle={`${results.length} addresses analyzed`}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Address
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Risk Level
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Triggered Rules
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tags
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.map((result, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Link
                            to={`/address?q=${result.address}`}
                            className="inline-flex items-center gap-1 font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {result.address.slice(0, 10)}...
                            {result.address.slice(-8)}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="font-medium">
                            {result.riskScore.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <RiskBadge level={result.riskLevel} size="sm" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {result.factors
                              ?.filter((f) => f.triggered)
                              .map((f, j) => (
                                <span
                                  key={j}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  {f.name}
                                </span>
                              ))}
                            {result.factors?.filter((f) => f.triggered).length === 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded">
                                <XCircle className="w-3 h-3" />
                                None
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {result.tags?.map((tag, j) => (
                              <span
                                key={j}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                              >
                                <Tag className="w-3 h-3" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Empty State */}
          {!batchMutation.isPending && results.length === 0 && (
            <div className="text-center py-12">
              <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto" />
              <p className="text-gray-500 mt-4">
                Enter addresses above to analyze their risk
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
