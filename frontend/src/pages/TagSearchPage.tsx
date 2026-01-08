import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tag, Search } from "lucide-react"
import { Card, Button, Input, LoadingSpinner } from "@/components/common"
import { AddressTable } from "@/components/table"
import { useGraphControllerSearchByTag } from "@/api/generated"

export function TagSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tagInput, setTagInput] = useState("")

  const queryTag = searchParams.get("q") || ""

  useEffect(() => {
    if (queryTag) {
      setTagInput(queryTag)
    }
  }, [queryTag])

  const searchQuery = useGraphControllerSearchByTag(
    queryTag,
    { limit: 50 },
    {
      query: { enabled: !!queryTag },
    }
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (tagInput.trim()) {
      setSearchParams({ q: tagInput.trim() })
    }
  }

  const addresses = searchQuery.data || []

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Tag className="w-6 h-6 text-indigo-600" />
              Tag Search
            </h1>
            <p className="text-gray-600 mt-1">Find addresses by tag</p>
          </div>

          <Card>
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Enter tag (e.g., exchange, mixer, scam)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                />
              </div>
              <Button type="submit" loading={searchQuery.isLoading}>
                <Search className="w-4 h-4 mr-1" />
                Search
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {searchQuery.isLoading && (
            <div className="py-12">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {addresses.length > 0 && (
            <Card
              title={`Addresses with tag "${queryTag}"`}
              subtitle={`${addresses.length} results`}
            >
              <AddressTable addresses={addresses} showTxCount showInOut showTags />
            </Card>
          )}

          {!searchQuery.isLoading && addresses.length === 0 && queryTag && (
            <div className="text-center py-12">
              <Tag className="w-16 h-16 text-gray-300 mx-auto" />
              <p className="text-gray-500 mt-4">
                No addresses found with tag "{queryTag}"
              </p>
            </div>
          )}

          {!queryTag && (
            <div className="text-center py-12">
              <Tag className="w-16 h-16 text-gray-300 mx-auto" />
              <p className="text-gray-500 mt-4">Enter a tag to search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
