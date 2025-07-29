"use client"

import { useCart } from "@/contexts/CartContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"

export function CartSummary() {
  const { items } = useCart()

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shipping = subtotal > 100 ? 0 : 10
  const tax = subtotal * 0.08 // 8% tax
  const total = subtotal + shipping + tax

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between">
          <span>Shipping</span>
          <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
        </div>

        <div className="flex justify-between">
          <span>Tax</span>
          <span>${tax.toFixed(2)}</span>
        </div>

        <Separator />

        <div className="flex justify-between font-semibold text-lg">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

        {subtotal < 100 && (
          <p className="text-sm text-muted-foreground">Add ${(100 - subtotal).toFixed(2)} more for free shipping!</p>
        )}

        <Button asChild className="w-full" size="lg">
          <Link href="/checkout">Proceed to Checkout</Link>
        </Button>

        <Button asChild variant="outline" className="w-full bg-transparent">
          <Link href="/products">Continue Shopping</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
