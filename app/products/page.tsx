import { Suspense } from "react"
import { ProductGrid } from "@/components/storefront/ProductGrid"
import { ProductFilters } from "@/components/storefront/ProductFilters"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

export const metadata = {
  title: "Products - ECommerce Platform",
  description: "Browse our complete collection of products",
}

export default function ProductsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-64">
          <ProductFilters />
        </aside>
        <main className="flex-1">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">All Products</h1>
            <p className="text-muted-foreground">Discover our complete collection</p>
          </div>
          <Suspense fallback={<LoadingSpinner />}>
            <ProductGrid />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
