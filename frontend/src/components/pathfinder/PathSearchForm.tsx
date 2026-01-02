import { ArrowLeftRight, Search } from "lucide-react"
import { Button, Input, Card } from "@/components/common"
import { Select } from "@/components/common/Select"

interface PathSearchFormProps {
  fromAddress: string
  toAddress: string
  maxDepth: number
  isLoading?: boolean
  onFromAddressChange: (value: string) => void
  onToAddressChange: (value: string) => void
  onMaxDepthChange: (value: number) => void
  onSearch: (from: string, to: string, maxDepth: number) => void
}

export function PathSearchForm({
  fromAddress,
  toAddress,
  maxDepth,
  isLoading,
  onFromAddressChange,
  onToAddressChange,
  onMaxDepthChange,
  onSearch,
}: PathSearchFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (fromAddress.trim() && toAddress.trim()) {
      onSearch(fromAddress.trim().toLowerCase(), toAddress.trim().toLowerCase(), maxDepth)
    }
  }

  const handleSwap = () => {
    const temp = fromAddress
    onFromAddressChange(toAddress)
    onToAddressChange(temp)
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Address
            </label>
            <Input
              placeholder="0x..."
              value={fromAddress}
              onChange={(e) => onFromAddressChange(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Address
            </label>
            <Input
              placeholder="0x..."
              value={toAddress}
              onChange={(e) => onToAddressChange(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Max Depth:</label>
            <Select
              value={maxDepth}
              onChange={(e) => onMaxDepthChange(Number(e.target.value))}
              options={[
                [3, "3 hops"],
                [5, "5 hops"],
                [7, "7 hops"],
                [10, "10 hops"],
              ]}
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={handleSwap}>
            <ArrowLeftRight className="w-4 h-4 mr-1" />
            Swap
          </Button>
          <Button type="submit" loading={isLoading}>
            <Search className="w-4 h-4 mr-1" />
            Find Path
          </Button>
        </div>
      </form>
    </Card>
  )
}
