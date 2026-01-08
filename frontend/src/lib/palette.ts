/**
 * Unified color palette for the application.
 * All color definitions should be imported from here to ensure consistency.
 */

// =============================================================================
// Risk Level Colors
// Used for risk scores (0.0 - 1.0) throughout the application
// =============================================================================

export const RISK_COLORS = {
  /** Critical risk (score >= 0.8) */
  critical: {
    hex: "#EF4444",
    hexLight: "#F87171",
    border: "#B91C1C",
    bg: "bg-red-100",
    bgSolid: "bg-red-500",
    text: "text-red-600",
    textDark: "text-red-800",
    borderTw: "border-red-200",
  },
  /** High risk (score >= 0.6) */
  high: {
    hex: "#F97316",
    hexLight: "#FB923C",
    border: "#C2410C",
    bg: "bg-orange-100",
    bgSolid: "bg-orange-500",
    text: "text-orange-600",
    textDark: "text-orange-800",
    borderTw: "border-orange-200",
  },
  /** Medium risk (score >= 0.4) */
  medium: {
    hex: "#FBBF24",
    hexLight: "#FCD34D",
    border: "#A16207",
    bg: "bg-yellow-100",
    bgSolid: "bg-yellow-500",
    text: "text-yellow-600",
    textDark: "text-yellow-800",
    borderTw: "border-yellow-200",
  },
  /** Low risk (score < 0.4) */
  low: {
    hex: "#10B981",
    hexLight: "#34D399",
    border: "#047857",
    bg: "bg-green-100",
    bgSolid: "bg-green-500",
    text: "text-green-600",
    textDark: "text-green-800",
    borderTw: "border-green-200",
  },
  /** Unknown/undefined risk */
  unknown: {
    hex: "#6B7280",
    hexLight: "#9CA3AF",
    border: "#374151",
    bg: "bg-gray-100",
    bgSolid: "bg-gray-500",
    text: "text-gray-600",
    textDark: "text-gray-800",
    borderTw: "border-gray-200",
  },
} as const

export type RiskLevel = keyof typeof RISK_COLORS

// =============================================================================
// Direction Colors
// Used for transfer/edge directions in graphs
// =============================================================================

export const DIRECTION_COLORS = {
  /** Incoming: from outer to inner (toward center) */
  incoming: {
    hex: "#3B82F6",
    bg: "bg-blue-100",
    bgSolid: "bg-blue-500",
    text: "text-blue-600",
    textDark: "text-blue-700",
  },
  /** Outgoing: from inner to outer (away from center) */
  outgoing: {
    hex: "#F97316",
    bg: "bg-orange-100",
    bgSolid: "bg-orange-500",
    text: "text-orange-600",
    textDark: "text-orange-700",
  },
  /** Bidirectional */
  both: {
    hex: "#8B5CF6",
    bg: "bg-purple-100",
    bgSolid: "bg-purple-500",
    text: "text-purple-600",
    textDark: "text-purple-700",
  },
  /** Indirect connection */
  indirect: {
    hex: "#6B7280",
    bg: "bg-gray-100",
    bgSolid: "bg-gray-500",
    text: "text-gray-600",
    textDark: "text-gray-700",
  },
} as const

export type Direction = keyof typeof DIRECTION_COLORS

// =============================================================================
// Special Node Colors
// Used for special nodes in graph visualizations
// =============================================================================

export const NODE_COLORS = {
  /** Center/selected node */
  center: {
    hex: "#3B82F6",
    border: "#1E40AF",
  },
  /** Source node in path */
  source: {
    hex: "#3B82F6",
  },
  /** Target node in path */
  target: {
    hex: "#8B5CF6",
  },
} as const

// =============================================================================
// Utility Functions
// =============================================================================

/** Convert risk score (0-1) to risk level */
export function scoreToRiskLevel(score?: number): RiskLevel {
  if (score === undefined) return "unknown"
  if (score >= 0.8) return "critical"
  if (score >= 0.6) return "high"
  if (score >= 0.4) return "medium"
  return "low"
}

/** Get hex color for risk score (for ECharts/canvas) */
export function getRiskHex(score?: number): string {
  return RISK_COLORS[scoreToRiskLevel(score)].hex
}

/** Get light hex color for risk score */
export function getRiskHexLight(score?: number): string {
  return RISK_COLORS[scoreToRiskLevel(score)].hexLight
}

/** Get border hex color for risk score */
export function getRiskBorderHex(score?: number): string {
  return RISK_COLORS[scoreToRiskLevel(score)].border
}

/** Get Tailwind classes for risk badge */
export function getRiskBadgeClasses(score?: number): string {
  const colors = RISK_COLORS[scoreToRiskLevel(score)]
  return `${colors.bg} ${colors.textDark} ${colors.borderTw}`
}

/** Get Tailwind bg-solid class for risk indicator dot */
export function getRiskDotClass(score?: number): string {
  return RISK_COLORS[scoreToRiskLevel(score)].bgSolid
}

/** Get Tailwind text class for risk */
export function getRiskTextClass(score?: number): string {
  return RISK_COLORS[scoreToRiskLevel(score)].text
}

/** Get hex color for direction (for ECharts/canvas) */
export function getDirectionHex(direction?: Direction): string {
  return DIRECTION_COLORS[direction || "indirect"].hex
}

/** Get Tailwind classes for direction badge */
export function getDirectionBadgeClasses(direction?: Direction): string {
  const colors = DIRECTION_COLORS[direction || "indirect"]
  return `${colors.bg} ${colors.textDark}`
}

// =============================================================================
// Legacy exports for backward compatibility
// These map to the new unified definitions
// =============================================================================

/** @deprecated Use DIRECTION_COLORS instead */
export const EDGE_COLORS = {
  incoming: DIRECTION_COLORS.incoming.hex,
  outgoing: DIRECTION_COLORS.outgoing.hex,
  both: DIRECTION_COLORS.both.hex,
  indirect: DIRECTION_COLORS.indirect.hex,
} as const
