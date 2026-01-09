import { useState } from "react"
import { ShieldCheck, Search, AlertTriangle } from "lucide-react"
import {
  Card,
  Button,
  Input,
  LoadingSpinner,
  RiskBadge,
  ClickableTag,
} from "@/components/common"
import {
  useRiskControllerScoreAddress,
  useRiskControllerListRules,
} from "@/api/generated"

export function RiskPage() {
  const [address, setAddress] = useState("")

  const scoreMutation = useRiskControllerScoreAddress()
  const rulesQuery = useRiskControllerListRules()

  const handleScore = (e: React.FormEvent) => {
    e.preventDefault()
    if (address.trim()) {
      scoreMutation.mutate({ data: { address: address.trim().toLowerCase() } })
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              Risk Scoring
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Calculate risk scores for addresses
            </p>
          </div>

          <Card>
            <form onSubmit={handleScore} className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Enter Ethereum address (0x...)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <Button type="submit" loading={scoreMutation.isPending}>
                <Search className="w-4 h-4 mr-1" />
                Score
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {scoreMutation.data && (
            <Card title="Risk Score Result">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm text-gray-900 dark:text-white">
                    {scoreMutation.data.address}
                  </p>
                  <RiskBadge
                    level={scoreMutation.data.riskLevel}
                    score={scoreMutation.data.riskScore}
                    size="lg"
                  />
                </div>

                {scoreMutation.data.factors && scoreMutation.data.factors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Risk Factors
                    </h4>
                    <div className="space-y-2">
                      {scoreMutation.data.factors
                        .filter((f) => f.triggered)
                        .map((factor, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/30 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              <span className="text-sm text-gray-900 dark:text-white">
                                {factor.name}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {factor.score?.toFixed(2)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {scoreMutation.data.tags && scoreMutation.data.tags.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {scoreMutation.data.tags.map((tag, i) => (
                        <ClickableTag key={i} tag={tag} variant="risk" size="md" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card title="Risk Rules" subtitle="Active risk scoring rules">
            {rulesQuery.isLoading ? (
              <LoadingSpinner />
            ) : rulesQuery.data && rulesQuery.data.length > 0 ? (
              <div className="space-y-2">
                {rulesQuery.data.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {rule.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {rule.description}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        rule.enabled
                          ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No rules found</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
