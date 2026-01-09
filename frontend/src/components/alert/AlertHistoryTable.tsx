import { formatDistanceToNow } from "date-fns"
import { Eye, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { Card } from "@/components/common/Card"
import { Button } from "@/components/common/Button"
import { SeverityBadge, StatusBadge } from "./AlertBadges"
import type { AlertHistoryResponse } from "@/api/generated"

interface AlertHistoryTableProps {
  alerts: AlertHistoryResponse[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onAcknowledge?: (id: number) => void
  onViewDetails?: (alert: AlertHistoryResponse) => void
  isLoading?: boolean
}

export function AlertHistoryTable({
  alerts,
  total,
  page,
  pageSize,
  onPageChange,
  onAcknowledge,
  onViewDetails,
  isLoading,
}: AlertHistoryTableProps) {
  const totalPages = Math.ceil(total / pageSize)

  const formatEntityId = (id: string) => {
    if (id.length > 20) {
      return `${id.slice(0, 10)}...${id.slice(-8)}`
    }
    return id
  }

  return (
    <Card title="Alert History" subtitle={`${total} alerts total`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                Time
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                Severity
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                Title
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                Entity
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                Status
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : alerts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No alerts found
                </td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <tr
                  key={alert.id}
                  className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                >
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <SeverityBadge severity={alert.severity} size="sm" />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {alert.title}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300">
                      {formatEntityId(alert.entityId)}
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={alert.status} size="sm" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      {onViewDetails && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetails(alert)}
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      {onAcknowledge && alert.status !== "acknowledged" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAcknowledge(alert.id)}
                          title="Acknowledge"
                        >
                          <CheckCircle className="w-4 h-4" />
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

interface AlertDetailModalProps {
  alert: AlertHistoryResponse | null
  onClose: () => void
  onAcknowledge?: (id: number) => void
}

export function AlertDetailModal({ alert, onClose, onAcknowledge }: AlertDetailModalProps) {
  if (!alert) return null

  const metadata = alert.metadata as Record<string, unknown> | undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {alert.title}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <SeverityBadge severity={alert.severity} />
                <StatusBadge status={alert.status} />
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Message
            </label>
            <p className="mt-1 text-gray-900 dark:text-white">{alert.message}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Entity Type
              </label>
              <p className="mt-1 text-gray-900 dark:text-white">{alert.entityType}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Alert Type
              </label>
              <p className="mt-1 text-gray-900 dark:text-white">{alert.alertType}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Entity ID
            </label>
            <code className="mt-1 block text-sm bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded font-mono text-gray-700 dark:text-gray-300 break-all">
              {alert.entityId}
            </code>
          </div>

          {metadata && Object.keys(metadata).length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Metadata
              </label>
              <pre className="mt-1 text-sm bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="font-medium text-gray-500 dark:text-gray-400">Created</label>
              <p className="mt-1 text-gray-900 dark:text-white">
                {new Date(alert.createdAt).toLocaleString()}
              </p>
            </div>
            {alert.notifiedAt && (
              <div>
                <label className="font-medium text-gray-500 dark:text-gray-400">Notified</label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {new Date(alert.notifiedAt).toLocaleString()}
                </p>
              </div>
            )}
            {alert.acknowledgedAt && (
              <div>
                <label className="font-medium text-gray-500 dark:text-gray-400">
                  Acknowledged
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {new Date(alert.acknowledgedAt).toLocaleString()}
                  {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          {onAcknowledge && alert.status !== "acknowledged" && (
            <Button onClick={() => onAcknowledge(alert.id)}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Acknowledge
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
