"use client"

import { useState, useEffect, useRef } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useSearch } from "@/contexts/SearchContext"
import { useI18n } from "@/contexts/I18nContext"
import { useDebounce } from "@/hooks/useDebounce"
import Link from "next/link"

export function SmartSearch() {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const { searchResults, searchSuggestions, performSearch, clearSearch } = useSearch()
  const { t } = useI18n()
  const debouncedQuery = useDebounce(query, 300)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      performSearch(debouncedQuery)
      setIsOpen(true)
    } else {
      clearSearch()
      setIsOpen(false)
    }
  }, [debouncedQuery, performSearch, clearSearch])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleClear = () => {
    setQuery("")
    clearSearch()
    setIsOpen(false)
  }

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isOpen && (searchResults.length > 0 || searchSuggestions.length > 0) && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-96 overflow-y-auto">
          <CardContent className="p-0">
            {/* Search Suggestions */}
            {searchSuggestions.length > 0 && (
              <div className="border-b p-2">
                <div className="text-xs font-medium text-muted-foreground mb-2">{t("search.suggestions")}</div>
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setQuery(suggestion)
                      performSearch(suggestion)
                    }}
                    className="block w-full text-left px-2 py-1 text-sm hover:bg-accent rounded"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="p-2">
                <div className="text-xs font-medium text-muted-foreground mb-2">{t("search.products")}</div>
                {searchResults.slice(0, 5).map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center space-x-3 p-2 hover:bg-accent rounded"
                  >
                    <img
                      src={product.images[0] || "/placeholder.svg"}
                      alt={product.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{product.name}</div>
                      <div className="text-sm text-muted-foreground">${product.price.toFixed(2)}</div>
                    </div>
                  </Link>
                ))}
                {searchResults.length > 5 && (
                  <Link
                    href={`/search?q=${encodeURIComponent(query)}`}
                    onClick={() => setIsOpen(false)}
                    className="block text-center text-sm text-primary hover:underline py-2"
                  >
                    {t("search.viewAll", { count: searchResults.length })}
                  </Link>
                )}
              </div>
            )}

            {/* No Results */}
            {query.length >= 2 && searchResults.length === 0 && searchSuggestions.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">{t("search.noResults")}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
