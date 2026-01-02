import { AddressTable } from "@/components/table"
import type { GraphAddressInfo } from "@/types"

interface HighRiskTableProps {
  addresses: GraphAddressInfo[]
}

export function HighRiskTable({ addresses }: HighRiskTableProps) {
  return (
    <AddressTable
      addresses={addresses}
      showTxCount={true}
      showInOut={true}
      showTags={true}
      showLastSeen={false}
      maxTagsDisplay={3}
    />
  )
}
