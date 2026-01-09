import { Link } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { Eye, CheckCircle, ChevronLeft, ChevronRight, ExternalLink, Network } from "lucide-react"
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

  const isAddress = (entityType: string) => entityType === "address"

  return (
    <Card title="Alert History" subtitle={`${total} alerts total`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Entity
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
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={alert.severity} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {alert.title}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isAddress(alert.entityType) ? (
                      <Link
                        to={`/address?q=${alert.entityId}`}
                        className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                      >
                        {formatEntityId(alert.entityId)}
                      </Link>
                    ) : (
                      <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300">
                        {formatEntityId(alert.entityId)}
                      </code>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={alert.status} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {isAddress(alert.entityType) && (
                        <>
                          <Link
                            to={`/address?q=${alert.entityId}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="View Address"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                          <Link
                            to={`/graph?address=${alert.entityId}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
                            title="View Graph"
                          >
                            <Network className="w-3 h-3" />
                          </Link>
                        </>
                      )}
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
  const isAddress = alert.entityType === "address"

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
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 text-sm bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded font-mono text-gray-700 dark:text-gray-300 break-all">
                {alert.entityId}
              </code>
              {isAddress && (
                <div className="flex gap-1 flex-shrink-0">
                  <Link
                    to={`/address?q=${alert.entityId}`}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                    onClick={onClose}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Details
                  </Link>
                  <Link
                    to={`/graph?address=${alert.entityId}`}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
                    onClick={onClose}
                  >
                    <Network className="w-3 h-3" />
                    Graph
                  </Link>
                </div>
              )}
            </div>
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
