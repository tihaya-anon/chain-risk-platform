import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, Card, LoadingSpinner, RiskBadge } from '@/components/common'
import { riskService } from '@/services'
import type { RiskScore, RiskRule } from '@/types'

export function RiskPage() {
  const [addresses, setAddresses] = useState('')
  const [results, setResults] = useState<RiskScore[]>([])

  const rulesQuery = useQuery({
    queryKey: ['riskRules'],
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
      .split('\n')
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Risk Analysis</h1>
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
                rows={6}
                placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f1b7E0&#10;0x1234567890abcdef1234567890abcdef12345678&#10;..."
                value={addresses}
                onChange={(e) => setAddresses(e.target.value)}
              />
            </div>
            <Button type="submit" loading={batchMutation.isPending}>
              Analyze Addresses
            </Button>
          </form>
        </Card>

        {/* Risk Rules */}
        <Card title="Active Rules">
          {rulesQuery.isLoading ? (
            <LoadingSpinner />
          ) : rulesQuery.data ? (
            <div className="space-y-3">
              {rulesQuery.data.map((rule: RiskRule, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {rule.name}
                    </p>
                    <p className="text-xs text-gray-500">{rule.description}</p>
                  </div>
                  <span className="text-sm text-gray-600">
                    ×{rule.weight.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Failed to load rules</p>
          )}
        </Card>
      </div>

      {/* Results */}
      {batchMutation.isPending && (
        <div className="py-12">
          <LoadingSpinner size="lg" />
          <p className="text-center text-gray-500 mt-4">Analyzing addresses...</p>
        </div>
      )}

      {results.length > 0 && (
        <Card
          title="Analysis Results"
          subtitle={`${results.length} addresses analyzed`}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
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
                      <span className="font-mono text-sm">
                        {result.address.slice(0, 10)}...{result.address.slice(-8)}
                      </span>
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
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                            >
                              {f.name}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {result.tags?.map((tag, j) => (
                          <span
                            key={j}
                            className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                          >
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
          <span className="text-6xl">⚠️</span>
          <p className="text-gray-500 mt-4">
            Enter addresses above to analyze their risk
          </p>
        </div>
      )}
    </div>
  )
}
