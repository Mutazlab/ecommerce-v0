"use client"

import { useEffect, useState } from "react"
import { ProductCard } from "./ProductCard"
import { useRecommendations } from "@/contexts/RecommendationContext"
import { useAuth } from "@/contexts/AuthContext"
import { useI18n } from "@/contexts/I18nContext"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

export function PersonalizedRecommendations() {
  const { personalizedProducts } = useRecommendations()
  const { user } = useAuth()
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading time for recommendations
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (!user || isLoading) {
    return (
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-8">{t("product.recommendedForYou")}</h2>
          <LoadingSpinner />
        </div>
      </section>
    )
  }

  if (personalizedProducts.length === 0) {
    return null
  }

  return (
    <section className="py-12 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8">Recommended for You</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {personalizedProducts.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}
