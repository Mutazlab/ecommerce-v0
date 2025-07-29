import { ProductCard } from "./ProductCard"
import { getProducts } from "@/lib/api/products"

interface ProductGridProps {
  limit?: number
  categoryId?: string
}

export async function ProductGrid({ limit, categoryId }: ProductGridProps) {
  const products = await getProducts({ limit, categoryId })

  if (!products.length) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No products found.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
