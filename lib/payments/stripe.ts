import Stripe from "stripe"
import { query } from "@/lib/database/connection"
import { sendWebhook } from "@/lib/webhooks/sender"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

export interface PaymentIntent {
  amount: number
  currency: string
  orderId: string
  customerId?: string
  metadata?: Record<string, string>
}

export interface SubscriptionData {
  customerId: string
  priceId: string
  metadata?: Record<string, string>
}

// Create payment intent
export async function createPaymentIntent(data: PaymentIntent) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(data.amount * 100), // Convert to cents
      currency: data.currency.toLowerCase(),
      customer: data.customerId,
      metadata: {
        orderId: data.orderId,
        ...data.metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    }
  } catch (error) {
    console.error("Stripe payment intent creation error:", error)
    throw new Error("Failed to create payment intent")
  }
}

// Create subscription
export async function createSubscription(data: SubscriptionData) {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: data.customerId,
      items: [{ price: data.priceId }],
      metadata: data.metadata,
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
    })

    return {
      subscriptionId: subscription.id,
      clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
    }
  } catch (error) {
    console.error("Stripe subscription creation error:", error)
    throw new Error("Failed to create subscription")
  }
}

// Handle webhook events
export async function handleStripeWebhook(event: Stripe.Event) {
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent)
        break

      case "payment_intent.payment_failed":
        await handlePaymentFailure(event.data.object as Stripe.PaymentIntent)
        break

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription)
        break

      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`)
    }
  } catch (error) {
    console.error("Stripe webhook handling error:", error)
    throw error
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId

  if (orderId) {
    // Update order status
    await query(
      "UPDATE orders SET payment_status = $1, payment_gateway_transaction_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
      ["paid", paymentIntent.id, orderId],
    )

    // Send webhook notification
    await sendWebhook("payment.succeeded", {
      orderId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
    })

    // Trigger order fulfillment
    await triggerOrderFulfillment(orderId)
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId

  if (orderId) {
    await query("UPDATE orders SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
      "failed",
      orderId,
    ])

    await sendWebhook("payment.failed", {
      orderId,
      paymentIntentId: paymentIntent.id,
      error: paymentIntent.last_payment_error?.message,
    })
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (invoice.subscription) {
    await sendWebhook("subscription.invoice_paid", {
      subscriptionId: invoice.subscription,
      invoiceId: invoice.id,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
    })
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  await sendWebhook("subscription.canceled", {
    subscriptionId: subscription.id,
    customerId: subscription.customer as string,
    canceledAt: new Date(subscription.canceled_at! * 1000),
  })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId

  if (orderId) {
    await query(
      "UPDATE orders SET payment_status = $1, payment_gateway_transaction_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
      ["paid", session.payment_intent as string, orderId],
    )

    await sendWebhook("checkout.completed", {
      orderId,
      sessionId: session.id,
      customerId: session.customer as string,
      amount: session.amount_total! / 100,
      currency: session.currency!,
    })
  }
}

async function triggerOrderFulfillment(orderId: string) {
  // Update order status to processing
  await query("UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", ["processing", orderId])

  // Send fulfillment webhook
  await sendWebhook("order.fulfillment_required", { orderId })
}

export { stripe }
