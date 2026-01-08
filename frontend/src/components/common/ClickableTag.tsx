import { useNavigate } from "react-router-dom"

interface ClickableTagProps {
  tag: string
  variant?: "default" | "risk" | "info" | "warning"
  size?: "sm" | "md"
  className?: string
}

const variantStyles = {
  default: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  risk: "bg-red-100 text-red-700 hover:bg-red-200",
  info: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  warning: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
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
