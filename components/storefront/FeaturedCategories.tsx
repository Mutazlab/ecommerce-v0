import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"

const categories = [
  { name: "Electronics", href: "/categories/electronics", image: "/placeholder.svg?height=200&width=300" },
  { name: "Clothing", href: "/categories/clothing", image: "/placeholder.svg?height=200&width=300" },
  { name: "Home & Garden", href: "/categories/home-garden", image: "/placeholder.svg?height=200&width=300" },
  { name: "Sports", href: "/categories/sports", image: "/placeholder.svg?height=200&width=300" },
]

export function FeaturedCategories() {
  return (
    <section className="py-12 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8">Shop by Category</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((category) => (
            <Link key={category.name} href={category.href}>
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <img
                      src={category.image || "/placeholder.svg"}
                      alt={category.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-center">{category.name}</h3>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
