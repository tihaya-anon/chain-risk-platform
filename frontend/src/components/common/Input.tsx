import { clsx } from 'clsx'
import { Input as BaseInput } from '@base-ui-components/react/input'
import { Field } from '@base-ui-components/react/field'
import type { ComponentProps } from 'react'

interface InputProps extends ComponentProps<typeof BaseInput> {
  label?: string
  error?: string
  helperText?: string
}

export function Input({
  label,
  error,
  helperText,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <Field.Root className="w-full">
      {label && (
        <Field.Label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </Field.Label>
      )}
      <BaseInput
        id={inputId}
        className={clsx(
          'w-full px-3 py-2 border rounded-lg shadow-sm',
          'placeholder-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'disabled:bg-gray-50 disabled:text-gray-500',
          error
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300',
          className
        )}
        {...props}
      />
      {error && (
        <Field.Error className="mt-1 text-sm text-red-600">
          {error}
        </Field.Error>
      )}
      {helperText && !error && (
        <Field.Description className="mt-1 text-sm text-gray-500">
          {helperText}
        </Field.Description>
      )}
    </Field.Root>
  )
}
