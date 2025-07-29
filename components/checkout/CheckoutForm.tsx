"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useCart } from "@/contexts/CartContext"

const checkoutSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "ZIP code is required"),
  cardNumber: z.string().min(16, "Card number must be at least 16 digits"),
  expiryDate: z.string().regex(/^\d{2}\/\d{2}$/, "Invalid expiry date (MM/YY)"),
  cvv: z.string().min(3, "CVV must be at least 3 digits"),
})

type CheckoutFormData = z.infer<typeof checkoutSchema>

interface CheckoutFormProps {
  onSubmit: (processing: boolean) => void
  isProcessing: boolean
}

export function CheckoutForm({ onSubmit, isProcessing }: CheckoutFormProps) {
  const { clearCart } = useCart()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
  })

  const processOrder = async (data: CheckoutFormData) => {
    onSubmit(true)

    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // In a real app, you would:
      // 1. Process payment with Stripe/PayPal
      // 2. Create order in database
      // 3. Send confirmation email
      // 4. Update inventory

      clearCart()
      toast({
        title: "Order placed successfully!",
        description: "You will receive a confirmation email shortly.",
      })

      // Redirect to success page
      window.location.href = "/order-success"
    } catch (error) {
      toast({
        title: "Payment failed",
        description: "Please check your payment details and try again.",
        variant: "destructive",
      })
    } finally {
      onSubmit(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(processOrder)} className="space-y-6">
      {/* Contact Information */}
      <div>
        <h3 className="font-semibold mb-4">Contact Information</h3>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} className={errors.email ? "border-destructive" : ""} />
          {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
        </div>
      </div>

      <Separator />

      {/* Shipping Address */}
      <div>
        <h3 className="font-semibold mb-4">Shipping Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">First Name</Label>
            <Input id="firstName" {...register("firstName")} className={errors.firstName ? "border-destructive" : ""} />
            {errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName.message}</p>}
          </div>

          <div>
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" {...register("lastName")} className={errors.lastName ? "border-destructive" : ""} />
            {errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="address">Address</Label>
          <Input id="address" {...register("address")} className={errors.address ? "border-destructive" : ""} />
          {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register("city")} className={errors.city ? "border-destructive" : ""} />
            {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message}</p>}
          </div>

          <div>
            <Label htmlFor="state">State</Label>
            <Input id="state" {...register("state")} className={errors.state ? "border-destructive" : ""} />
            {errors.state && <p className="text-sm text-destructive mt-1">{errors.state.message}</p>}
          </div>

          <div>
            <Label htmlFor="zipCode">ZIP Code</Label>
            <Input id="zipCode" {...register("zipCode")} className={errors.zipCode ? "border-destructive" : ""} />
            {errors.zipCode && <p className="text-sm text-destructive mt-1">{errors.zipCode.message}</p>}
          </div>
        </div>
      </div>

      <Separator />

      {/* Payment Information */}
      <div>
        <h3 className="font-semibold mb-4">Payment Information</h3>
        <div>
          <Label htmlFor="cardNumber">Card Number</Label>
          <Input
            id="cardNumber"
            placeholder="1234 5678 9012 3456"
            {...register("cardNumber")}
            className={errors.cardNumber ? "border-destructive" : ""}
          />
          {errors.cardNumber && <p className="text-sm text-destructive mt-1">{errors.cardNumber.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <Label htmlFor="expiryDate">Expiry Date</Label>
            <Input
              id="expiryDate"
              placeholder="MM/YY"
              {...register("expiryDate")}
              className={errors.expiryDate ? "border-destructive" : ""}
            />
            {errors.expiryDate && <p className="text-sm text-destructive mt-1">{errors.expiryDate.message}</p>}
          </div>

          <div>
            <Label htmlFor="cvv">CVV</Label>
            <Input id="cvv" placeholder="123" {...register("cvv")} className={errors.cvv ? "border-destructive" : ""} />
            {errors.cvv && <p className="text-sm text-destructive mt-1">{errors.cvv.message}</p>}
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isProcessing}>
        {isProcessing ? "Processing..." : "Place Order"}
      </Button>
    </form>
  )
}
