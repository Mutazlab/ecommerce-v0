"use client"

import { useState } from "react"
import { useCart } from "@/contexts/CartContext"
import { CheckoutForm } from "@/components/checkout/CheckoutForm"
import { OrderSummary } from "@/components/checkout/OrderSummary"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { redirect } from "next/navigation"

export default function CheckoutPage() {
  const { items } = useCart()
  const [isProcessing, setIsProcessing] = useState(false)

  if (items.length === 0) {
    redirect("/cart")
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Shipping & Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckoutForm onSubmit={setIsProcessing} isProcessing={isProcessing} />
            </CardContent>
          </Card>
        </div>

        <div>
          <OrderSummary />
        </div>
      </div>
    </div>
  )
}
