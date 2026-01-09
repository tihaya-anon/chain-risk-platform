import { useState } from "react"
import { Bell, List, Settings, BarChart3 } from "lucide-react"
import {
  AlertStatsCards,
  SeverityChart,
  AlertHistoryTable,
  AlertDetailModal,
  AlertRulesTable,
  RuleFormModal,
} from "@/components/alert"

// Types
type Severity = "low" | "medium" | "high" | "critical"
type Status = "pending" | "sent" | "acknowledged" | "resolved"

interface AlertHistoryItem {
  id: number
  ruleId?: number
  alertType: string
  severity: Severity
  entityType: string
  entityId: string
  title: string
  message: string
  metadata: Record<string, any>
  status: Status
  notifiedAt?: string
  acknowledgedAt?: string
  acknowledgedBy?: string
  createdAt: string
}

interface AlertRule {
  id: number
  name: string
  description: string
  ruleType: string
  severity: Severity
  conditions: Record<string, any>
  enabled: boolean
  createdAt: string
  updatedAt: string
}

interface AlertStats {
  total: number
  bySeverity: Record<string, number>
  byStatus: Record<string, number>
  byType: Record<string, number>
  averagePerHour: number
}

// Mock data
const mockStats: AlertStats = {
  total: 156,
  bySeverity: { critical: 12, high: 34, medium: 67, low: 43 },
  byStatus: { pending: 8, sent: 45, acknowledged: 89, resolved: 14 },
  byType: { risk_score: 78, transaction_value: 45, tag_match: 33 },
  averagePerHour: 6.5,
}

const mockAlerts: AlertHistoryItem[] = [
  {
    id: 1,
    ruleId: 1,
    alertType: "risk_score",
    severity: "critical",
    entityType: "address",
    entityId: "0x742d35Cc6634C0532925a3b844Bc9e7595f1b7E0",
    title: "High risk score detected: 92.00",
    message: "Address risk score exceeded threshold",
    metadata: { score: 92, threshold: 80 },
    status: "sent",
    notifiedAt: "2026-01-09T04:20:00Z",
    createdAt: "2026-01-09T04:20:00Z",
  },
  {
    id: 2,
    ruleId: 2,
    alertType: "transaction_value",
    severity: "high",
    entityType: "transaction",
    entityId: "0xabc123def456789012345678901234567890abcdef1234567890abcdef12345678",
    title: "Large transaction detected: $2,500,000",
    message: "Transaction value exceeded threshold",
    metadata: { value_usd: 2500000, threshold: 1000000 },
    status: "acknowledged",
    notifiedAt: "2026-01-09T03:15:00Z",
    acknowledgedAt: "2026-01-09T03:30:00Z",
    acknowledgedBy: "admin",
    createdAt: "2026-01-09T03:15:00Z",
  },
  {
    id: 3,
    alertType: "tag_match",
    severity: "medium",
    entityType: "address",
    entityId: "0x1234567890123456789012345678901234567890",
    title: "Suspicious tag detected: mixer",
    message: "Address tagged with suspicious label",
    metadata: { matched_tags: ["mixer"], rule_tags: ["mixer", "sanctioned"] },
    status: "pending",
    createdAt: "2026-01-09T02:45:00Z",
  },
]

const mockRules: AlertRule[] = [
  {
    id: 1,
    name: "High Risk Score Alert",
    description: "Alert when risk score exceeds threshold",
    ruleType: "risk_score",
    severity: "critical",
    conditions: { threshold: 80, operator: ">=" },
    enabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-05T00:00:00Z",
  },
  {
    id: 2,
    name: "Large Transaction",
    description: "Alert on transactions over $1M USD",
    ruleType: "transaction_value",
    severity: "high",
    conditions: { threshold: 1000000, currency: "USD" },
    enabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: 3,
    name: "Mixer Detection",
    description: "Alert on addresses with mixer tags",
    ruleType: "tag_match",
    severity: "medium",
    conditions: { tags: ["mixer", "tornado"], match_mode: "any" },
    enabled: false,
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z",
  },
]

type TabType = "overview" | "history" | "rules"

export function AlertsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [historyPage, setHistoryPage] = useState(1)
  const [selectedAlert, setSelectedAlert] = useState<AlertHistoryItem | null>(null)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [showRuleForm, setShowRuleForm] = useState(false)

  const tabs = [
    { id: "overview" as TabType, label: "Overview", icon: BarChart3 },
    { id: "history" as TabType, label: "Alert History", icon: List },
    { id: "rules" as TabType, label: "Rules", icon: Settings },
  ]

  const handleAcknowledge = (id: number) => {
    console.log("Acknowledge alert:", id)
    // TODO: Call API
  }

  const handleDeleteRule = (id: number) => {
    if (confirm("Are you sure you want to delete this rule?")) {
      console.log("Delete rule:", id)
      // TODO: Call API
    }
  }

  const handleToggleRule = (id: number, enabled: boolean) => {
    console.log("Toggle rule:", id, enabled)
    // TODO: Call API
  }

  const handleSaveRule = (data: Partial<AlertRule>) => {
    console.log("Save rule:", data)
    // TODO: Call API
    setShowRuleForm(false)
    setEditingRule(null)
  }

  const handleViewDetails = (alert: AlertHistoryItem) => {
    setSelectedAlert(alert)
  }

  const handleEditRule = (rule: AlertRule) => {
    setEditingRule(rule)
    setShowRuleForm(true)
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <Bell className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alerts</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Monitor and manage alert rules and notifications
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <AlertStatsCards stats={mockStats} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SeverityChart bySeverity={mockStats.bySeverity} />
            <AlertHistoryTable
              alerts={mockAlerts.slice(0, 5)}
              total={mockAlerts.length}
              page={1}
              pageSize={5}
              onPageChange={() => setActiveTab("history")}
              onViewDetails={handleViewDetails}
            />
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <AlertHistoryTable
          alerts={mockAlerts}
          total={mockAlerts.length}
          page={historyPage}
          pageSize={20}
          onPageChange={setHistoryPage}
          onAcknowledge={handleAcknowledge}
          onViewDetails={handleViewDetails}
        />
      )}

      {activeTab === "rules" && (
        <AlertRulesTable
          rules={mockRules}
          onEdit={handleEditRule}
          onDelete={handleDeleteRule}
          onToggle={handleToggleRule}
          onCreate={() => {
            setEditingRule(null)
            setShowRuleForm(true)
          }}
        />
      )}

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
    </div>
  )
}
