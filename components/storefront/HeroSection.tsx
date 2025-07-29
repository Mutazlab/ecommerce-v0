import Link from "next/link"
import { Button } from "@/components/ui/button"

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Discover Amazing Products</h1>
          <p className="text-xl mb-8 opacity-90">
            Shop from our curated collection of high-quality products with fast shipping and excellent customer service.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg" variant="secondary">
              <Link href="/products">Shop Now</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary bg-transparent"
            >
              <Link href="/categories">Browse Categories</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
