"use client"

import type React from "react"

import Link from "next/link"
import { useState } from "react"
import { ShoppingCart, Heart } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCart } from "@/contexts/CartContext"
import { useToast } from "@/hooks/use-toast"
import type { Product } from "@/lib/types"

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { addItem } = useCart()
  const { toast } = useToast()

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.images[0] || "/placeholder.svg",
        quantity: 1,
      })

      toast({
        title: "Added to cart",
        description: `${product.name} has been added to your cart.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add item to cart.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const discountPercentage = product.comparePrice
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0

  return (
    <Link href={`/products/${product.slug}`}>
      <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300">
        <CardContent className="p-0">
          <div className="relative aspect-square overflow-hidden">
            <img
              src={product.images[0] || "/placeholder.svg?height=300&width=300&query=product"}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {discountPercentage > 0 && (
              <Badge className="absolute top-2 left-2 bg-destructive">-{discountPercentage}%</Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
              onClick={(e) => {
                e.preventDefault()
                // Add to wishlist functionality
              }}
            >
              <Heart className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
        <CardFooter className="p-4">
          <div className="w-full">
            <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{product.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold">${product.price.toFixed(2)}</span>
                {product.comparePrice && (
                  <span className="text-sm text-muted-foreground line-through">${product.comparePrice.toFixed(2)}</span>
                )}
              </div>
              <Button
                size="sm"
                onClick={handleAddToCart}
                disabled={isLoading || product.inventory <= 0}
                className="shrink-0"
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                {product.inventory <= 0 ? "Out of Stock" : "Add"}
              </Button>
            </div>
            {product.inventory <= 5 && product.inventory > 0 && (
              <p className="text-xs text-orange-600 mt-1">Only {product.inventory} left!</p>
            )}
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
