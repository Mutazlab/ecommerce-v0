"use client"

import { useState } from "react"
import { Minus, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "@/contexts/CartContext"
import type { CartItem as CartItemType } from "@/lib/types"

interface CartItemProps {
  item: CartItemType
}

export function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart()
  const [isUpdating, setIsUpdating] = useState(false)

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1) return

    setIsUpdating(true)
    try {
      await updateQuantity(item.id, newQuantity)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemove = async () => {
    setIsUpdating(true)
    try {
      await removeItem(item.id)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <img src={item.image || "/placeholder.svg"} alt={item.name} className="w-16 h-16 object-cover rounded" />

          <div className="flex-1">
            <h3 className="font-semibold">{item.name}</h3>
            <p className="text-sm text-muted-foreground">${item.price.toFixed(2)} each</p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleQuantityChange(item.quantity - 1)}
              disabled={isUpdating || item.quantity <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>

            <span className="w-8 text-center">{item.quantity}</span>

            <Button
              variant="outline"
              size="icon"
              onClick={() => handleQuantityChange(item.quantity + 1)}
              disabled={isUpdating}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-right">
            <p className="font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isUpdating}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
