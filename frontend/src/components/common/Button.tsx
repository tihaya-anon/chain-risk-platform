import { clsx } from "clsx"
import { Button as BaseButton } from "@base-ui-components/react/button"
import { Loader2 } from "lucide-react"
import type { ReactNode, ButtonHTMLAttributes, ReactElement } from "react"
import { Children, isValidElement } from "react"

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost"
type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children?: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-blue-500 text-white hover:bg-blue-700 focus:ring-blue-400",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500",
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  // Process children to replace the first icon with loader when loading
  const processedChildren = loading
    ? (() => {
      const childArray = Children.toArray(children)
      let iconReplaced = false

      return childArray.map((child, index) => {
        // Check if this is a React element (likely an icon)
        if (!iconReplaced && isValidElement(child)) {
          // Type assertion to access props
          const element = child as ReactElement<any>
          const childClassName = element.props?.className

          // Check if it looks like a lucide icon (has w- and h- classes)
          if (
            typeof childClassName === "string" &&
            childClassName.includes("w-") &&
            childClassName.includes("h-")
          ) {
            iconReplaced = true
            // Replace with Loader2, keeping the same className and adding animate-spin
            return (
              <Loader2
                key={`loader-${index}`}
                className={`${childClassName} animate-spin`}
              />
            )
          }
        }
        return child
      })
    })()
    : children

  return (
    <BaseButton
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center font-medium rounded-lg",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        "transition-colors duration-200",
        "hover: cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {processedChildren}
    </BaseButton>
  )
}
