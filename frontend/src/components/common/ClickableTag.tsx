import { useNavigate } from "react-router-dom"

interface ClickableTagProps {
  tag: string
  variant?: "default" | "risk" | "info" | "warning"
  size?: "sm" | "md"
  className?: string
}

const variantStyles = {
  default:
    "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
  risk: "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/70",
  info: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/70",
  warning:
    "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-900/70",
}

const sizeStyles = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2 py-1 text-sm",
}

export function ClickableTag({
  tag,
  variant = "default",
  size = "sm",
  className = "",
}: ClickableTagProps) {
  const navigate = useNavigate()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/tags?q=${encodeURIComponent(tag)}`)
  }

  return (
    <button
      onClick={handleClick}
      className={`rounded font-medium cursor-pointer transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {tag}
    </button>
  )
}
