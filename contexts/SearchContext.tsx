"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { searchProducts, getSearchSuggestions } from "@/lib/api/search"
import type { Product } from "@/lib/types"

interface SearchContextType {
  searchResults: Product[]
  searchSuggestions: string[]
  isSearching: boolean
  performSearch: (query: string) => Promise<void>
  clearSearch: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

interface SearchProviderProps {
  children: ReactNode
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      clearSearch()
      return
    }

    setIsSearching(true)
    try {
      const [results, suggestions] = await Promise.all([searchProducts(query), getSearchSuggestions(query)])

      setSearchResults(results)
      setSearchSuggestions(suggestions)
    } catch (error) {
      console.error("Search error:", error)
      setSearchResults([])
      setSearchSuggestions([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const clearSearch = useCallback(() => {
    setSearchResults([])
    setSearchSuggestions([])
    setIsSearching(false)
  }, [])

  return (
    <SearchContext.Provider
      value={{
        searchResults,
        searchSuggestions,
        isSearching,
        performSearch,
        clearSearch,
      }}
    >
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider")
  }
  return context
}
