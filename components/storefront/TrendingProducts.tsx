import { getTrendingProducts } from "@/lib/api/recommendations"
import { ProductCard } from "./ProductCard"

export async function TrendingProducts() {
  const trendingProducts = await getTrendingProducts()

  if (trendingProducts.length === 0) {
    return null
  }

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8">Trending Now</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {trendingProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}
