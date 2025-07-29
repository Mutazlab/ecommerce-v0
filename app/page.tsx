import { Suspense } from "react"
import { HeroSection } from "@/components/storefront/HeroSection"
import { FeaturedCategories } from "@/components/storefront/FeaturedCategories"
import { ProductGrid } from "@/components/storefront/ProductGrid"
import { PersonalizedRecommendations } from "@/components/storefront/PersonalizedRecommendations"
import { TrendingProducts } from "@/components/storefront/TrendingProducts"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeaturedCategories />

      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-8">Featured Products</h2>
          <Suspense fallback={<LoadingSpinner />}>
            <ProductGrid limit={8} />
          </Suspense>
        </div>
      </section>

      <Suspense fallback={<LoadingSpinner />}>
        <PersonalizedRecommendations />
      </Suspense>

      <Suspense fallback={<LoadingSpinner />}>
        <TrendingProducts />
      </Suspense>
    </div>
  )
}
