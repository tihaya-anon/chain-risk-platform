import { Link } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { Bell, ArrowRight } from "lucide-react"
import { LoadingSpinner } from "@/components/common"
import { SeverityBadge, StatusBadge } from "@/components/alert/AlertBadges"
import { useAlertControllerListHistory, type AlertHistoryResponse } from "@/api/generated"

interface AddressAlertsSectionProps {
  address: string
}

export function AddressAlertsSection({ address }: AddressAlertsSectionProps) {
  const { data, isLoading, error } = useAlertControllerListHistory(
    { entityId: address, pageSize: 5, page: 1 },
    { query: { enabled: !!address } }
  )

  if (isLoading) {
    return (
      <div className="py-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        Failed to load alerts
      </div>
    )
  }

  const alerts = data?.data || []

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
        <p className="text-gray-500 dark:text-gray-400 mt-3">No alerts for this address</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} />
      ))}

      {(data?.total ?? 0) > 5 && (
        <Link
          to={`/alerts?entityId=${address}`}
          className="flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          View all {data?.total} alerts
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}

function AlertItem({ alert }: { alert: AlertHistoryResponse }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <SeverityBadge severity={alert.severity} size="sm" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{alert.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{alert.message}</p>
      </div>
      <StatusBadge status={alert.status} size="sm" />
    </div>
  )
}
