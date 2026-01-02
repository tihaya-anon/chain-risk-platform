import clsx from "clsx"
import { ReactNode, SelectHTMLAttributes } from "react"

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children?: ReactNode
  options?: Array<[string | number | readonly string[] | undefined, string]>
}
export function Select({ value, onChange, className, children, ...props }: SelectProps) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={clsx(
        "px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:cursor-pointer",
        className
      )}
      {...props}
    >
      {props.options?.map(([value, label]) => (
        <option value={value}>{label}</option>
      ))}
      {children}
    </select>
  )
}
