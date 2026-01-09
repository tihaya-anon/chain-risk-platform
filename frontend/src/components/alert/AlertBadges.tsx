import { clsx } from "clsx"
import type {
  AlertHistoryResponseSeverity,
  AlertHistoryResponseStatus,
} from "@/api/generated"
import { RISK_COLORS, type RiskLevel } from "@/lib/palette"

// Severity maps to RiskLevel (same enum values)
type Severity = AlertHistoryResponseSeverity | RiskLevel

interface SeverityBadgeProps {
  severity: Severity | string
  size?: "sm" | "md" | "lg"
}

// Use RISK_COLORS for consistency with RiskBadge
const severityStyles: Record<RiskLevel, string> = {
  critical: `${RISK_COLORS.critical.bg} ${RISK_COLORS.critical.textDark} ${RISK_COLORS.critical.borderTw}`,
  high: `${RISK_COLORS.high.bg} ${RISK_COLORS.high.textDark} ${RISK_COLORS.high.borderTw}`,
  medium: `${RISK_COLORS.medium.bg} ${RISK_COLORS.medium.textDark} ${RISK_COLORS.medium.borderTw}`,
  low: `${RISK_COLORS.low.bg} ${RISK_COLORS.low.textDark} ${RISK_COLORS.low.borderTw}`,
  unknown: `${RISK_COLORS.unknown.bg} ${RISK_COLORS.unknown.textDark} ${RISK_COLORS.unknown.borderTw}`,
}

const severityLabels: Record<RiskLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  unknown: "Unknown",
}

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
}

export function SeverityBadge({ severity, size = "md" }: SeverityBadgeProps) {
  const level = (severity as RiskLevel) || "unknown"

  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full border",
        severityStyles[level] || severityStyles.unknown,
        sizeStyles[size]
      )}
    >
      {severityLabels[level] || "Unknown"}
    </span>
  )
}

// Status Badge (separate color scheme)
interface StatusBadgeProps {
  status: AlertHistoryResponseStatus | string
  size?: "sm" | "md"
}

const statusStyles: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
  sent: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  failed: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  acknowledged: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  resolved: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
}

const statusLabels: Record<string, string> = {
  pending: "Pending",
  sent: "Sent",
  failed: "Failed",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full border",
        statusStyles[status] || statusStyles.pending,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      )}
    >
      {statusLabels[status] || status}
    </span>
  )
}
