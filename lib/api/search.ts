import type { Product } from "@/lib/types"
import { getProducts } from "./products"

// Fuzzy search implementation
function fuzzyMatch(text: string, query: string): number {
  const textLower = text.toLowerCase()
  const queryLower = query.toLowerCase()

  // Exact match gets highest score
  if (textLower.includes(queryLower)) {
    return 1.0
  }

  // Calculate Levenshtein distance for fuzzy matching
  const distance = levenshteinDistance(textLower, queryLower)
  const maxLength = Math.max(text.length, query.length)

  // Convert distance to similarity score (0-1)
  return Math.max(0, 1 - distance / maxLength)
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null))

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator, // substitution
      )
    }
  }

  return matrix[str2.length][str1.length]
}

// Synonym mapping for better search results
const synonyms: Record<string, string[]> = {
  phone: ["mobile", "smartphone", "cell", "device"],
  laptop: ["computer", "notebook", "pc"],
  shirt: ["top", "blouse", "tee"],
  shoes: ["footwear", "sneakers", "boots"],
  bag: ["purse", "handbag", "backpack"],
  watch: ["timepiece", "clock"],
}

function expandQueryWithSynonyms(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/)
  const expandedQueries = [query]

  words.forEach((word) => {
    Object.entries(synonyms).forEach(([key, values]) => {
      if (word === key || values.includes(word)) {
        const allSynonyms = [key, ...values]
        allSynonyms.forEach((synonym) => {
          if (synonym !== word) {
            expandedQueries.push(query.replace(new RegExp(word, "gi"), synonym))
          }
        })
      }
    })
  })

  return [...new Set(expandedQueries)]
}

export async function searchProducts(query: string): Promise<Product[]> {
  if (!query.trim()) return []

  try {
    const allProducts = await getProducts({})
    const expandedQueries = expandQueryWithSynonyms(query)

    // Score products based on relevance
    const scoredProducts = allProducts.map((product) => {
      let maxScore = 0

      expandedQueries.forEach((expandedQuery) => {
        // Search in product name (highest weight)
        const nameScore = fuzzyMatch(product.name, expandedQuery) * 3

        // Search in description (medium weight)
        const descScore = fuzzyMatch(product.description, expandedQuery) * 2

        // Search in tags (medium weight)
        const tagScore = product.tags.reduce((acc, tag) => Math.max(acc, fuzzyMatch(tag, expandedQuery)), 0) * 2

        // Search in category (low weight)
        const categoryScore = fuzzyMatch(product.category, expandedQuery) * 1

        const totalScore = nameScore + descScore + tagScore + categoryScore
        maxScore = Math.max(maxScore, totalScore)
      })

      return { product, score: maxScore }
    })

    // Filter and sort by relevance
    return scoredProducts
      .filter(({ score }) => score > 0.3) // Minimum relevance threshold
      .sort((a, b) => b.score - a.score)
      .map(({ product }) => product)
      .slice(0, 20) // Limit results
  } catch (error) {
    console.error("Search error:", error)
    return []
  }
}

export async function getSearchSuggestions(query: string): Promise<string[]> {
  if (!query.trim() || query.length < 2) return []

  try {
    const allProducts = await getProducts({})
    const suggestions = new Set<string>()

    // Extract suggestions from product names and tags
    allProducts.forEach((product) => {
      // Add product name if it matches
      if (fuzzyMatch(product.name, query) > 0.5) {
        suggestions.add(product.name)
      }

      // Add matching tags
      product.tags.forEach((tag) => {
        if (fuzzyMatch(tag, query) > 0.5) {
          suggestions.add(tag)
        }
      })

      // Add category if it matches
      if (fuzzyMatch(product.category, query) > 0.5) {
        suggestions.add(product.category)
      }
    })

    // Add synonym suggestions
    const expandedQueries = expandQueryWithSynonyms(query)
    expandedQueries.forEach((expandedQuery) => {
      if (expandedQuery !== query) {
        suggestions.add(expandedQuery)
      }
    })

    return Array.from(suggestions).slice(0, 5)
  } catch (error) {
    console.error("Suggestions error:", error)
    return []
  }
}
