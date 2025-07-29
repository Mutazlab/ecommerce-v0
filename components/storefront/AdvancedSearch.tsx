"use client"

import { useState, useEffect } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/contexts/I18nContext"
import { useDebounce } from "@/hooks/useDebounce"
import { searchProducts } from "@/lib/elasticsearch/setup"
import { ProductCard } from "./ProductCard"

interface SearchFilters {
  query: string
  categories: string[]
  priceRange: [number, number]
  inStock: boolean
  featured: boolean
  sortBy: string
}

export function AdvancedSearch() {
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    categories: [],
    priceRange: [0, 1000],
    inStock: false,
    featured: false,
    sortBy: "relevance",
  })
  const [results, setResults] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [totalResults, setTotalResults] = useState(0)

  const { t, locale } = useI18n()
  const debouncedQuery = useDebounce(filters.query, 300)

  useEffect(() => {
    if (
      debouncedQuery.length >= 2 ||
      Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : typeof v === "boolean" ? v : false))
    ) {
      performSearch()
    } else {
      setResults([])
      setSuggestions([])
      setTotalResults(0)
    }
  }, [debouncedQuery, filters]) // Updated to include filters as a dependency

  const performSearch = async () => {
    setLoading(true)
    try {
      const searchFilters = {
        category: filters.categories.length > 0 ? filters.categories[0] : undefined,
        price_min: filters.priceRange[0],
        price_max: filters.priceRange[1],
        in_stock: filters.inStock,
        featured: filters.featured,
        sort: filters.sortBy,
        limit: 20,
        offset: 0,
      }

      const result = await searchProducts(debouncedQuery, locale, searchFilters)
      setResults(result.products)
      setSuggestions(result.suggestions)
      setTotalResults(result.total)
    } catch (error) {
      console.error("Search error:", error)
      setResults([])
      setSuggestions([])
      setTotalResults(0)
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setFilters({
      query: "",
      categories: [],
      priceRange: [0, 1000],
      inStock: false,
      featured: false,
      sortBy: "relevance",
    })
  }

  const removeFilter = (type: string, value?: any) => {
    switch (type) {
      case "category":
        setFilters((prev) => ({
          ...prev,
          categories: prev.categories.filter((c) => c !== value),
        }))
        break
      case "inStock":
        setFilters((prev) => ({ ...prev, inStock: false }))
        break
      case "featured":
        setFilters((prev) => ({ ...prev, featured: false }))
        break
      case "priceRange":
        setFilters((prev) => ({ ...prev, priceRange: [0, 1000] }))
        break
    }
  }

  const activeFiltersCount =
    filters.categories.length +
    (filters.inStock ? 1 : 0) +
    (filters.featured ? 1 : 0) +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < 1000 ? 1 : 0)

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("search.placeholder")}
          value={filters.query}
          onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
          className="pl-12 pr-12 h-12 text-lg"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className="absolute right-2 top-1/2 -translate-y-1/2"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {activeFiltersCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Search Suggestions */}
      {suggestions.length > 0 && filters.query.length >= 2 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-2">{t("search.suggestions")}</div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters((prev) => ({ ...prev, query: suggestion }))}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{t("filters.activeFilters")}:</span>

          {filters.categories.map((category) => (
            <Badge key={category} variant="secondary" className="gap-1">
              {category}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("category", category)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}

          {filters.inStock && (
            <Badge variant="secondary" className="gap-1">
              {t("filters.inStock")}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("inStock")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {filters.featured && (
            <Badge variant="secondary" className="gap-1">
              {t("product.featured")}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("featured")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {(filters.priceRange[0] > 0 || filters.priceRange[1] < 1000) && (
            <Badge variant="secondary" className="gap-1">
              ${filters.priceRange[0]} - ${filters.priceRange[1]}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("priceRange")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t("filters.clearAll")}
          </Button>
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {t("filters.advancedFilters")}
              <Button variant="ghost" size="icon" onClick={() => setShowFilters(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Price Range */}
            <div>
              <Label className="text-sm font-medium mb-3 block">
                {t("filters.priceRange")}: ${filters.priceRange[0]} - ${filters.priceRange[1]}
              </Label>
              <Slider
                value={filters.priceRange}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, priceRange: value as [number, number] }))}
                max={1000}
                step={10}
                className="mb-2"
              />
            </div>

            {/* Availability */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="inStock"
                checked={filters.inStock}
                onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, inStock: !!checked }))}
              />
              <Label htmlFor="inStock">{t("filters.inStockOnly")}</Label>
            </div>

            {/* Featured */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="featured"
                checked={filters.featured}
                onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, featured: !!checked }))}
              />
              <Label htmlFor="featured">{t("product.featured")}</Label>
            </div>

            {/* Sort Options */}
            <div>
              <Label className="text-sm font-medium mb-3 block">{t("filters.sortBy")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "relevance", label: t("filters.relevance") },
                  { value: "price_asc", label: t("filters.priceLowToHigh") },
                  { value: "price_desc", label: t("filters.priceHighToLow") },
                  { value: "newest", label: t("filters.newest") },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={filters.sortBy === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilters((prev) => ({ ...prev, sortBy: option.value }))}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <div>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">{t("common.loading")}</p>
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground">
                {t("search.resultsFound", { count: totalResults, query: filters.query })}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        ) : filters.query.length >= 2 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t("search.noResults")}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
