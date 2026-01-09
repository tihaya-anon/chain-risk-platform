import { Link } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { Bell, AlertTriangle, ArrowRight } from "lucide-react"
import { LoadingSpinner } from "@/components/common"
import { useListAlertsByEntity, type AlertHistory, type Severity } from "@/api/generated"

interface AddressAlertsSectionProps {
  address: string
}

const severityStyles: Record<Severity, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
}

export function AddressAlertsSection({ address }: AddressAlertsSectionProps) {
  const { data, isLoading, error } = useListAlertsByEntity(address, 5)

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
        <p className="text-gray-500 dark:text-gray-400 mt-3">
          No alerts for this address
        </p>
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

function AlertItem({ alert }: { alert: AlertHistory }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <AlertTriangle
        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
          alert.severity === "critical" || alert.severity === "high"
            ? "text-red-500"
            : "text-yellow-500"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
              severityStyles[alert.severity]
            }`}
          >
            {alert.severity}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {alert.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {alert.message}
        </p>
      </div>
      <span
        className={`text-xs px-2 py-0.5 rounded-full ${
          alert.status === "acknowledged"
            ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
            : alert.status === "pending"
              ? "bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
        }`}
      >
        {alert.status}
      </span>
    </div>
  )
}
