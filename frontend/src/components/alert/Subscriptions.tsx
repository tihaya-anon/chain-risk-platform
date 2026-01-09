import { useState } from "react"
import { Plus, Trash2, Mail, Globe, MessageSquare, Send } from "lucide-react"
import { Card } from "@/components/common/Card"
import { Button } from "@/components/common/Button"
import type {
  SubscriptionResponse,
  AlertRuleResponse,
  CreateSubscriptionDto,
  CreateSubscriptionDtoChannelType,
} from "@/api/generated"

interface SubscriptionsTableProps {
  subscriptions: SubscriptionResponse[]
  rules: AlertRuleResponse[]
  onDelete?: (id: number) => void
  onCreate?: () => void
  isLoading?: boolean
}

const channelIcons: Record<CreateSubscriptionDtoChannelType, typeof Mail> = {
  email: Mail,
  webhook: Globe,
  slack: MessageSquare,
  telegram: Send,
}

const channelLabels: Record<CreateSubscriptionDtoChannelType, string> = {
  email: "Email",
  webhook: "Webhook",
  slack: "Slack",
  telegram: "Telegram",
}

export function SubscriptionsTable({
  subscriptions,
  rules,
  onDelete,
  onCreate,
  isLoading,
}: SubscriptionsTableProps) {
  const getRuleName = (ruleId?: number) => {
    if (!ruleId) return "All Rules"
    const rule = rules.find((r) => r.id === ruleId)
    return rule?.name || `Rule #${ruleId}`
  }

  const getChannelDisplay = (sub: SubscriptionResponse) => {
    const config = sub.channelConfig as Record<string, any> | undefined
    if (!config) return "—"
    switch (sub.channelType) {
      case "email":
        return config.email || config.address || "—"
      case "webhook":
        return config.url ? truncateUrl(config.url) : "—"
      case "slack":
        return config.channel || config.webhook_url ? "Configured" : "—"
      case "telegram":
        return config.chat_id ? `Chat: ${config.chat_id}` : "—"
      default:
        return "—"
    }
  }

  return (
    <Card
      title="Notification Subscriptions"
      subtitle={`${subscriptions.length} subscriptions`}
      action={
        onCreate && (
          <Button size="sm" onClick={onCreate}>
            <Plus className="w-4 h-4 mr-1" />
            New Subscription
          </Button>
        )
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Channel
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Destination
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Rule
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500 dark:text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : subscriptions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No subscriptions. Create one to receive notifications.
                </td>
              </tr>
            ) : (
              subscriptions.map((sub) => {
                const channelType = sub.channelType as CreateSubscriptionDtoChannelType
                const Icon = channelIcons[channelType] || Mail
                return (
                  <tr
                    key={sub.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {channelLabels[channelType] || channelType}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300">
                        {getChannelDisplay(sub)}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {getRuleName(sub.ruleId)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          sub.enabled
                            ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {sub.enabled ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {onDelete && (
                          <Button variant="ghost" size="sm" onClick={() => onDelete(sub.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function truncateUrl(url: string): string {
  if (url.length <= 40) return url
  return url.slice(0, 35) + "..."
}

interface SubscriptionFormModalProps {
  rules: AlertRuleResponse[]
  onClose: () => void
  onSave: (data: CreateSubscriptionDto) => void
  isLoading?: boolean
}

export function SubscriptionFormModal({
  rules,
  onClose,
  onSave,
  isLoading,
}: SubscriptionFormModalProps) {
  const [channelType, setChannelType] = useState<CreateSubscriptionDtoChannelType>("email")
  const [ruleId, setRuleId] = useState<number | undefined>(undefined)
  const [channelConfig, setChannelConfig] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      userId: "",
      channelType,
      ruleId: ruleId || undefined,
      channelConfig,
      enabled: true,
    })
  }

  const renderChannelConfig = () => {
    switch (channelType) {
      case "email":
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={channelConfig.email || ""}
              onChange={(e) => setChannelConfig({ email: e.target.value })}
              placeholder="alerts@example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        )
      case "webhook":
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Webhook URL
            </label>
            <input
              type="url"
              value={channelConfig.url || ""}
              onChange={(e) => setChannelConfig({ url: e.target.value })}
              placeholder="https://example.com/webhook"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        )
      case "slack":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Slack Webhook URL
              </label>
              <input
                type="url"
                value={channelConfig.webhook_url || ""}
                onChange={(e) => setChannelConfig({ ...channelConfig, webhook_url: e.target.value })}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Channel (optional)
              </label>
              <input
                type="text"
                value={channelConfig.channel || ""}
                onChange={(e) => setChannelConfig({ ...channelConfig, channel: e.target.value })}
                placeholder="#alerts"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )
      case "telegram":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bot Token
              </label>
              <input
                type="text"
                value={channelConfig.bot_token || ""}
                onChange={(e) => setChannelConfig({ ...channelConfig, bot_token: e.target.value })}
                placeholder="123456789:ABC-DEF..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Chat ID
              </label>
              <input
                type="text"
                value={channelConfig.chat_id || ""}
                onChange={(e) => setChannelConfig({ ...channelConfig, chat_id: e.target.value })}
                placeholder="-1001234567890"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              New Subscription
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configure how you want to receive alert notifications
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notification Channel
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["email", "webhook", "slack", "telegram"] as CreateSubscriptionDtoChannelType[]).map(
                  (type) => {
                    const Icon = channelIcons[type]
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setChannelType(type)
                          setChannelConfig({})
                        }}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                          channelType === type
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{channelLabels[type]}</span>
                      </button>
                    )
                  }
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alert Rule
              </label>
              <select
                value={ruleId || ""}
                onChange={(e) => setRuleId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Rules</option>
                {rules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Select a specific rule or receive notifications for all rules
              </p>
            </div>

            {renderChannelConfig()}
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isLoading}>
              Create Subscription
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
