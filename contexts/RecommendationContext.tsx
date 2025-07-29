"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getPersonalizedRecommendations, getRelatedProducts } from "@/lib/api/recommendations"
import { useAuth } from "./AuthContext"
import type { Product } from "@/lib/types"

interface RecommendationContextType {
  personalizedProducts: Product[]
  relatedProducts: Record<string, Product[]>
  getRelatedProductsForItem: (productId: string) => Promise<Product[]>
  refreshRecommendations: () => Promise<void>
}

const RecommendationContext = createContext<RecommendationContextType | undefined>(undefined)

interface RecommendationProviderProps {
  children: ReactNode
}

export function RecommendationProvider({ children }: RecommendationProviderProps) {
  const [personalizedProducts, setPersonalizedProducts] = useState<Product[]>([])
  const [relatedProducts, setRelatedProducts] = useState<Record<string, Product[]>>({})
  const { user } = useAuth()

  const refreshRecommendations = async () => {
    if (user) {
      try {
        const recommendations = await getPersonalizedRecommendations(user.id)
        setPersonalizedProducts(recommendations)
      } catch (error) {
        console.error("Failed to fetch personalized recommendations:", error)
      }
    }
  }

  const getRelatedProductsForItem = async (productId: string): Promise<Product[]> => {
    if (relatedProducts[productId]) {
      return relatedProducts[productId]
    }

    try {
      const related = await getRelatedProducts(productId)
      setRelatedProducts((prev) => ({
        ...prev,
        [productId]: related,
      }))
      return related
    } catch (error) {
      console.error("Failed to fetch related products:", error)
      return []
    }
  }

  useEffect(() => {
    refreshRecommendations()
  }, [user])

  return (
    <RecommendationContext.Provider
      value={{
        personalizedProducts,
        relatedProducts,
        getRelatedProductsForItem,
        refreshRecommendations,
      }}
    >
      {children}
    </RecommendationContext.Provider>
  )
}

export function useRecommendations() {
  const context = useContext(RecommendationContext)
  if (context === undefined) {
    throw new Error("useRecommendations must be used within a RecommendationProvider")
  }
  return context
}
