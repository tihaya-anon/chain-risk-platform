import { clsx } from "clsx"
import type { Severity, AlertStatus } from "@/api/generated"

interface SeverityBadgeProps {
  severity: Severity
  size?: "sm" | "md"
}

const severityStyles: Record<Severity, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
}

export function SeverityBadge({ severity, size = "md" }: SeverityBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full capitalize",
        severityStyles[severity],
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      )}
    >
      {severity}
    </span>
  )
}

interface StatusBadgeProps {
  status: AlertStatus
  size?: "sm" | "md"
}

const statusStyles: Record<AlertStatus, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  acknowledged: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full capitalize",
        statusStyles[status],
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      )}
    >
      {status}
    </span>
  )
}
