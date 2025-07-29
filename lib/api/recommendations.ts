import type { Product } from "@/lib/types"
import { getProducts, getProductById } from "./products"

// Collaborative filtering algorithm
export async function getPersonalizedRecommendations(userId: string): Promise<Product[]> {
  try {
    // In a real implementation, this would use user behavior data
    // For now, we'll simulate with popular and related products
    const allProducts = await getProducts({})

    // Simulate user preferences based on purchase history
    // This would typically come from a recommendation engine or ML model
    const userPreferences = await getUserPreferences(userId)

    // Score products based on user preferences
    const scoredProducts = allProducts.map((product) => {
      let score = 0

      // Category preference
      if (userPreferences.categories.includes(product.category)) {
        score += 3
      }

      // Tag preferences
      product.tags.forEach((tag) => {
        if (userPreferences.tags.includes(tag)) {
          score += 2
        }
      })

      // Price range preference
      if (product.price >= userPreferences.priceRange.min && product.price <= userPreferences.priceRange.max) {
        score += 1
      }

      // Add some randomness for diversity
      score += Math.random() * 0.5

      return { product, score }
    })

    return scoredProducts
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(({ product }) => product)
  } catch (error) {
    console.error("Personalized recommendations error:", error)
    return []
  }
}

// Content-based filtering for related products
export async function getRelatedProducts(productId: string): Promise<Product[]> {
  try {
    const targetProduct = await getProductById(productId)
    if (!targetProduct) return []

    const allProducts = await getProducts({})

    // Score products based on similarity to target product
    const scoredProducts = allProducts
      .filter((product) => product.id !== productId)
      .map((product) => {
        let score = 0

        // Same category gets high score
        if (product.category === targetProduct.category) {
          score += 5
        }

        // Shared tags
        const sharedTags = product.tags.filter((tag) => targetProduct.tags.includes(tag)).length
        score += sharedTags * 2

        // Similar price range (within 50%)
        const priceDiff = Math.abs(product.price - targetProduct.price) / targetProduct.price
        if (priceDiff <= 0.5) {
          score += 2
        }

        return { product, score }
      })

    return scoredProducts
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ product }) => product)
  } catch (error) {
    console.error("Related products error:", error)
    return []
  }
}

// Simulate user preferences (in real app, this would come from analytics)
async function getUserPreferences(userId: string) {
  // This would typically be stored in database and updated based on user behavior
  return {
    categories: ["electronics", "clothing"],
    tags: ["wireless", "premium", "comfortable"],
    priceRange: { min: 50, max: 500 },
  }
}

// Trending products algorithm
export async function getTrendingProducts(): Promise<Product[]> {
  try {
    const allProducts = await getProducts({})

    // Simulate trending based on various factors
    const trendingProducts = allProducts.map((product) => {
      let trendScore = 0

      // Low inventory suggests high demand
      if (product.inventory < 10) {
        trendScore += 3
      }

      // Products with compare price (on sale) tend to be popular
      if (product.comparePrice) {
        trendScore += 2
      }

      // Certain categories might be trending
      if (["electronics", "clothing"].includes(product.category)) {
        trendScore += 1
      }

      // Add randomness for variety
      trendScore += Math.random() * 2

      return { product, trendScore }
    })

    return trendingProducts
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, 8)
      .map(({ product }) => product)
  } catch (error) {
    console.error("Trending products error:", error)
    return []
  }
}
