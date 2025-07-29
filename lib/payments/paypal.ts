import { query } from "@/lib/database/connection"
import { sendWebhook } from "@/lib/webhooks/sender"

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!
const PAYPAL_BASE_URL =
  process.env.NODE_ENV === "production" ? "https://api.paypal.com" : "https://api.sandbox.paypal.com"

interface PayPalAccessToken {
  access_token: string
  expires_in: number
  token_type: string
}

// Get PayPal access token
async function getAccessToken(): Promise<string> {
  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64")

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })

    const data: PayPalAccessToken = await response.json()
    return data.access_token
  } catch (error) {
    console.error("PayPal access token error:", error)
    throw new Error("Failed to get PayPal access token")
  }
}

// Create PayPal order
export async function createPayPalOrder(orderData: {
  amount: number
  currency: string
  orderId: string
  returnUrl: string
  cancelUrl: string
}) {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: orderData.orderId,
            amount: {
              currency_code: orderData.currency,
              value: orderData.amount.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: orderData.returnUrl,
          cancel_url: orderData.cancelUrl,
        },
      }),
    })

    const order = await response.json()
    return order
  } catch (error) {
    console.error("PayPal order creation error:", error)
    throw new Error("Failed to create PayPal order")
  }
}

// Capture PayPal payment
export async function capturePayPalPayment(orderId: string) {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    const capture = await response.json()
    return capture
  } catch (error) {
    console.error("PayPal capture error:", error)
    throw new Error("Failed to capture PayPal payment")
  }
}

// Create PayPal subscription
export async function createPayPalSubscription(subscriptionData: {
  planId: string
  customId: string
  returnUrl: string
  cancelUrl: string
}) {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: subscriptionData.planId,
        custom_id: subscriptionData.customId,
        application_context: {
          return_url: subscriptionData.returnUrl,
          cancel_url: subscriptionData.cancelUrl,
        },
      }),
    })

    const subscription = await response.json()
    return subscription
  } catch (error) {
    console.error("PayPal subscription creation error:", error)
    throw new Error("Failed to create PayPal subscription")
  }
}

// Handle PayPal webhooks
export async function handlePayPalWebhook(event: any) {
  try {
    switch (event.event_type) {
      case "PAYMENT.SALE.COMPLETED":
        await handlePaymentCompleted(event)
        break

      case "BILLING.SUBSCRIPTION.ACTIVATED":
        await handleSubscriptionActivated(event)
        break

      case "BILLING.SUBSCRIPTION.CANCELLED":
        await handleSubscriptionCancelled(event)
        break

      default:
        console.log(`Unhandled PayPal event type: ${event.event_type}`)
    }
  } catch (error) {
    console.error("PayPal webhook handling error:", error)
    throw error
  }
}

async function handlePaymentCompleted(event: any) {
  const customId = event.resource.custom

  if (customId) {
    await query(
      "UPDATE orders SET payment_status = $1, payment_gateway_transaction_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
      ["paid", event.resource.id, customId],
    )

    await sendWebhook("payment.completed", {
      orderId: customId,
      transactionId: event.resource.id,
      amount: Number.parseFloat(event.resource.amount.total),
      currency: event.resource.amount.currency,
    })
  }
}

async function handleSubscriptionActivated(event: any) {
  await sendWebhook("subscription.activated", {
    subscriptionId: event.resource.id,
    customId: event.resource.custom_id,
    status: event.resource.status,
  })
}

async function handleSubscriptionCancelled(event: any) {
  await sendWebhook("subscription.cancelled", {
    subscriptionId: event.resource.id,
    customId: event.resource.custom_id,
    status: event.resource.status,
  })
}
