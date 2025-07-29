import { type NextRequest, NextResponse } from "next/server"
import { handlePayPalWebhook } from "@/lib/payments/paypal"

export async function POST(request: NextRequest) {
  try {
    const event = await request.json()

    // Verify PayPal webhook signature (implement proper verification)
    // const isValid = await verifyPayPalWebhook(request)
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    // }

    await handlePayPalWebhook(event)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("PayPal webhook error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
