import { useState } from "react"
import { Bell, List, Settings, BarChart3, RefreshCw, BellRing } from "lucide-react"
import {
  AlertStatsCards,
  SeverityChart,
  AlertHistoryTable,
  AlertDetailModal,
  AlertRulesTable,
  RuleFormModal,
} from "@/components/alert"
import { SubscriptionsTable, SubscriptionFormModal } from "@/components/alert/Subscriptions"
import { Button } from "@/components/common"
import {
  useAlertControllerListRules,
  useAlertControllerListHistory,
  useAlertControllerGetStats,
  useAlertControllerCreateRule,
  useAlertControllerUpdateRule,
  useAlertControllerDeleteRule,
  useAlertControllerEnableRule,
  useAlertControllerDisableRule,
  useAlertControllerAcknowledgeAlert,
  useAlertControllerListSubscriptions,
  useAlertControllerCreateSubscription,
  useAlertControllerDeleteSubscription,
  type AlertRuleResponse,
  type AlertHistoryResponse,
  type CreateAlertRuleDto,
  type AlertControllerListHistoryParams,
  type CreateSubscriptionDto,
} from "@/api/generated"

type TabType = "overview" | "history" | "rules" | "subscriptions"

export function AlertsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [historyPage, setHistoryPage] = useState(1)
  const [selectedAlert, setSelectedAlert] = useState<AlertHistoryResponse | null>(null)
  const [editingRule, setEditingRule] = useState<AlertRuleResponse | null>(null)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false)

  const pageSize = 20

  const historyQuery: AlertControllerListHistoryParams = {
    pageSize,
    page: historyPage,
  }

  // API hooks
  const { data: rules, isLoading: rulesLoading, refetch: refetchRules } = useAlertControllerListRules()
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useAlertControllerListHistory(historyQuery)
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useAlertControllerGetStats({ hours: 24 })
  const { data: subscriptions, isLoading: subscriptionsLoading, refetch: refetchSubscriptions } = useAlertControllerListSubscriptions()

  // Mutations
  const createRule = useAlertControllerCreateRule()
  const updateRule = useAlertControllerUpdateRule()
  const deleteRule = useAlertControllerDeleteRule()
  const enableRule = useAlertControllerEnableRule()
  const disableRule = useAlertControllerDisableRule()
  const acknowledgeAlert = useAlertControllerAcknowledgeAlert()
  const createSubscription = useAlertControllerCreateSubscription()
  const deleteSubscription = useAlertControllerDeleteSubscription()

  const tabs = [
    { id: "overview" as TabType, label: "Overview", icon: BarChart3 },
    { id: "history" as TabType, label: "History", icon: List },
    { id: "rules" as TabType, label: "Rules", icon: Settings },
    { id: "subscriptions" as TabType, label: "Subscriptions", icon: BellRing },
  ]

  const handleRefresh = () => {
    refetchStats()
    refetchHistory()
    refetchRules()
    refetchSubscriptions()
  }

  const handleAcknowledge = (id: number) => {
    acknowledgeAlert.mutate({ id })
  }

  const handleDeleteRule = (id: number) => {
    if (confirm("Delete this rule?")) {
      deleteRule.mutate({ id })
    }
  }

  const handleToggleRule = (id: number, enabled: boolean) => {
    if (enabled) {
      enableRule.mutate({ id })
    } else {
      disableRule.mutate({ id })
    }
  }

  const handleSaveRule = (data: CreateAlertRuleDto) => {
    if (editingRule) {
      updateRule.mutate({ id: editingRule.id, data })
    } else {
      createRule.mutate({ data })
    }
    setShowRuleForm(false)
    setEditingRule(null)
  }

  const handleViewDetails = (alert: AlertHistoryResponse) => {
    setSelectedAlert(alert)
  }

  const handleEditRule = (rule: AlertRuleResponse) => {
    setEditingRule(rule)
    setShowRuleForm(true)
  }

  const handleSaveSubscription = (data: CreateSubscriptionDto) => {
    createSubscription.mutate({ data }, {
      onSuccess: () => setShowSubscriptionForm(false),
    })
  }

  const handleDeleteSubscription = (id: number) => {
    if (confirm("Delete this subscription?")) {
      deleteSubscription.mutate({ id })
    }
  }

  const alertStats = stats
    ? {
        total: stats.total,
        bySeverity: stats.bySeverity as Record<string, number>,
        byStatus: stats.byStatus as Record<string, number>,
        byType: stats.byType as Record<string, number>,
        averagePerHour: stats.averagePerHour,
      }
    : { total: 0, bySeverity: {}, byStatus: {}, byType: {}, averagePerHour: 0 }

  const alertHistory = historyData?.data || []
  const historyTotal = historyData?.total || 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Bell className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alerts</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manage alert rules and notifications
                </p>
              </div>
            </div>
            <Button variant="secondary" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Tabs */}
          <div className="mt-4 border-b border-gray-200 dark:border-gray-700 -mb-px">
            <nav className="flex gap-4">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === id
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {activeTab === "overview" && (
            <>
              <AlertStatsCards stats={alertStats} isLoading={statsLoading} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SeverityChart bySeverity={alertStats.bySeverity} isLoading={statsLoading} />
                <AlertHistoryTable
                  alerts={alertHistory.slice(0, 5)}
                  total={Math.min(historyTotal, 5)}
                  page={1}
                  pageSize={5}
                  onPageChange={() => setActiveTab("history")}
                  onViewDetails={handleViewDetails}
                  isLoading={historyLoading}
                />
              </div>
            </>
          )}

          {activeTab === "history" && (
            <AlertHistoryTable
              alerts={alertHistory}
              total={historyTotal}
              page={historyPage}
              pageSize={pageSize}
              onPageChange={setHistoryPage}
              onAcknowledge={handleAcknowledge}
              onViewDetails={handleViewDetails}
              isLoading={historyLoading}
            />
          )}

          {activeTab === "rules" && (
            <AlertRulesTable
              rules={rules || []}
              onEdit={handleEditRule}
              onDelete={handleDeleteRule}
              onToggle={handleToggleRule}
              onCreate={() => {
                setEditingRule(null)
                setShowRuleForm(true)
              }}
              isLoading={rulesLoading}
            />
          )}

          {activeTab === "subscriptions" && (
            <SubscriptionsTable
              subscriptions={subscriptions || []}
              rules={rules || []}
              onDelete={handleDeleteSubscription}
              onCreate={() => setShowSubscriptionForm(true)}
              isLoading={subscriptionsLoading}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAcknowledge={handleAcknowledge}
        />
      )}

      {showRuleForm && (
        <RuleFormModal
          rule={editingRule}
          onClose={() => {
            setShowRuleForm(false)
            setEditingRule(null)
          }}
          onSave={handleSaveRule}
        />
      )}

      {showSubscriptionForm && (
        <SubscriptionFormModal
          rules={rules || []}
          onClose={() => setShowSubscriptionForm(false)}
          onSave={handleSaveSubscription}
          isLoading={createSubscription.isPending}
        />
      )}
    </div>
  )
}
