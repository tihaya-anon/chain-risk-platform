import { clsx } from "clsx"
import { Input as BaseInput } from "@base-ui-components/react/input"
import { Field } from "@base-ui-components/react/field"
import type { ComponentProps } from "react"

interface InputProps extends ComponentProps<typeof BaseInput> {
  label?: string
  error?: string
  helperText?: string
}

export function Input({ label, error, helperText, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-")

  return (
    <Field.Root className="w-full">
      {label && (
        <Field.Label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
        </Field.Label>
      )}
      <BaseInput
        id={inputId}
        className={clsx(
          "w-full px-3 py-2 border rounded-lg shadow-sm",
          "bg-white dark:bg-gray-800",
          "text-gray-900 dark:text-gray-100",
          "placeholder-gray-400 dark:placeholder-gray-500",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          "disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-900 dark:disabled:text-gray-500",
          "transition-colors",
          error
            ? "border-red-300 focus:ring-red-500 focus:border-red-500 dark:border-red-500"
            : "border-gray-300 dark:border-gray-600",
          className
        )}
        {...props}
      />
      {error && (
        <Field.Error className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </Field.Error>
      )}
      {helperText && !error && (
        <Field.Description className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {helperText}
        </Field.Description>
      )}
    </Field.Root>
  )
}
