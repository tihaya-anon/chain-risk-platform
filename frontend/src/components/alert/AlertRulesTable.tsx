import { useState } from "react"
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import { Card } from "@/components/common/Card"
import { Button } from "@/components/common/Button"
import { SeverityBadge } from "./AlertBadges"
import type {
  AlertRuleResponse,
  CreateAlertRuleDto,
  CreateAlertRuleDtoRuleType,
  CreateAlertRuleDtoSeverity,
} from "@/api/generated"

interface AlertRulesTableProps {
  rules: AlertRuleResponse[]
  onEdit?: (rule: AlertRuleResponse) => void
  onDelete?: (id: number) => void
  onToggle?: (id: number, enabled: boolean) => void
  onCreate?: () => void
  isLoading?: boolean
}

const ruleTypeLabels: Record<string, string> = {
  risk_score: "Risk Score",
  transaction_value: "Transaction Value",
  tag_match: "Tag Match",
  graph_pattern: "Graph Pattern",
  velocity: "Velocity",
  cluster_risk: "Cluster Risk",
}

export function AlertRulesTable({
  rules,
  onEdit,
  onDelete,
  onToggle,
  onCreate,
  isLoading,
}: AlertRulesTableProps) {
  return (
    <Card
      title="Alert Rules"
      subtitle={`${rules.length} rules configured`}
      action={
        onCreate && (
          <Button size="sm" onClick={onCreate}>
            <Plus className="w-4 h-4 mr-1" />
            New Rule
          </Button>
        )
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Conditions
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No rules configured
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onToggle?.(rule.id, !rule.enabled)}
                      className="flex items-center"
                      title={rule.enabled ? "Disable" : "Enable"}
                    >
                      {rule.enabled ? (
                        <ToggleRight className="w-6 h-6 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {rule.name}
                      </span>
                      {rule.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {rule.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {ruleTypeLabels[rule.ruleType] || rule.ruleType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={rule.severity} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300">
                      {formatConditions(rule.conditions as Record<string, unknown>)}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {onEdit && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(rule)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="ghost" size="sm" onClick={() => onDelete(rule.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function formatConditions(conditions: Record<string, unknown>): string {
  const parts: string[] = []
  const c = conditions as Record<string, any>
  if (c.threshold !== undefined) {
    const op = c.operator || ">="
    parts.push(`${op} ${c.threshold}`)
  }
  if (c.tags) {
    parts.push(`tags: ${c.tags.join(", ")}`)
  }
  if (c.count !== undefined) {
    parts.push(`count >= ${c.count}`)
  }
  if (c.window) {
    parts.push(`window: ${c.window}`)
  }
  return parts.join(" | ") || "—"
}

interface RuleFormModalProps {
  rule?: AlertRuleResponse | null
  onClose: () => void
  onSave: (data: CreateAlertRuleDto) => void
  isLoading?: boolean
}

export function RuleFormModal({ rule, onClose, onSave, isLoading }: RuleFormModalProps) {
  const [formData, setFormData] = useState<{
    name: string
    description: string
    ruleType: CreateAlertRuleDtoRuleType
    severity: CreateAlertRuleDtoSeverity
    conditions: Record<string, unknown>
    enabled: boolean
  }>({
    name: rule?.name || "",
    description: rule?.description || "",
    ruleType: (rule?.ruleType as CreateAlertRuleDtoRuleType) || "risk_score",
    severity: (rule?.severity as CreateAlertRuleDtoSeverity) || "medium",
    conditions: (rule?.conditions as Record<string, unknown>) || { threshold: 80, operator: ">=" },
    enabled: rule?.enabled ?? true,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: formData.name,
      description: formData.description || undefined,
      ruleType: formData.ruleType,
      severity: formData.severity,
      conditions: formData.conditions,
      enabled: formData.enabled,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {rule ? "Edit Rule" : "Create Rule"}
            </h2>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rule Type
                </label>
                <select
                  value={formData.ruleType}
                  onChange={(e) =>
                    setFormData({ ...formData, ruleType: e.target.value as CreateAlertRuleDtoRuleType })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="risk_score">Risk Score</option>
                  <option value="transaction_value">Transaction Value</option>
                  <option value="tag_match">Tag Match</option>
                  <option value="velocity">Velocity</option>
                  <option value="cluster_risk">Cluster Risk</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Severity
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) =>
                    setFormData({ ...formData, severity: e.target.value as CreateAlertRuleDtoSeverity })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Conditions (JSON)
              </label>
              <textarea
                value={JSON.stringify(formData.conditions, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    setFormData({ ...formData, conditions: parsed })
                  } catch {
                    // Allow invalid JSON while typing
                  }
                }}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              />
              <label htmlFor="enabled" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Enable this rule
              </label>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isLoading}>
              {rule ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
