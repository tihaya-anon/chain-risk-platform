import { clsx } from "clsx"
import { AlertTriangle, AlertCircle, Info, XCircle } from "lucide-react"

type Severity = "low" | "medium" | "high" | "critical"

interface SeverityBadgeProps {
  severity: Severity
  size?: "sm" | "md"
}

const severityConfig: Record<
  Severity,
  { icon: typeof AlertTriangle; bg: string; text: string; label: string }
> = {
  low: {
    icon: Info,
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    label: "Low",
  },
  medium: {
    icon: AlertCircle,
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
    label: "Medium",
  },
  high: {
    icon: AlertTriangle,
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
    label: "High",
  },
  critical: {
    icon: XCircle,
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    label: "Critical",
  },
}

export function SeverityBadge({ severity, size = "md" }: SeverityBadgeProps) {
  const config = severityConfig[severity] || severityConfig.medium
  const Icon = config.icon

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full font-medium",
        config.bg,
        config.text,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      )}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      {config.label}
    </span>
  )
}

type Status = "pending" | "sent" | "acknowledged" | "resolved"

interface StatusBadgeProps {
  status: Status
  size?: "sm" | "md"
}

const statusConfig: Record<Status, { bg: string; text: string; label: string }> = {
  pending: {
    bg: "bg-gray-100 dark:bg-gray-700",
    text: "text-gray-700 dark:text-gray-300",
    label: "Pending",
  },
  sent: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    label: "Sent",
  },
  acknowledged: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    label: "Acknowledged",
  },
  resolved: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-400",
    label: "Resolved",
  },
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full font-medium",
        config.bg,
        config.text,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      )}
    >
      {config.label}
    </span>
  )
}
