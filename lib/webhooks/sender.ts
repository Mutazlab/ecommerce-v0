import crypto from "crypto"
import { query } from "@/lib/database/connection"

export interface WebhookEvent {
  id: string
  type: string
  data: any
  timestamp: string
}

// Send webhook to registered endpoints
export async function sendWebhook(eventType: string, data: any) {
  try {
    // Get all active webhooks for this event type
    const result = await query("SELECT * FROM webhooks WHERE is_active = true AND $1 = ANY(events)", [eventType])

    const webhooks = result.rows

    if (webhooks.length === 0) {
      return
    }

    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
    }

    // Send to all registered webhooks
    const promises = webhooks.map((webhook) => sendToWebhook(webhook, event))
    await Promise.allSettled(promises)
  } catch (error) {
    console.error("Webhook sending error:", error)
  }
}

async function sendToWebhook(webhook: any, event: WebhookEvent) {
  const maxRetries = 3
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      const payload = JSON.stringify(event)
      const signature = generateSignature(payload, webhook.secret)

      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Event-Type": event.type,
          "X-Event-ID": event.id,
          "User-Agent": "ECommerce-Platform-Webhook/1.0",
        },
        body: payload,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      })

      // Log delivery
      await query(
        "INSERT INTO webhook_deliveries (webhook_id, event_type, payload, response_status, response_body, delivered_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [webhook.id, event.type, event, response.status, await response.text().catch(() => ""), new Date()],
      )

      if (response.ok) {
        console.log(`Webhook delivered successfully to ${webhook.url}`)
        return
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      attempt++
      console.error(`Webhook delivery attempt ${attempt} failed:`, error)

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000))
      } else {
        // Log failed delivery
        await query(
          "INSERT INTO webhook_deliveries (webhook_id, event_type, payload, response_status, response_body, delivered_at) VALUES ($1, $2, $3, $4, $5, $6)",
          [webhook.id, event.type, event, 0, error instanceof Error ? error.message : "Unknown error", new Date()],
        )
      }
    }
  }
}

function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex")
}

// Verify webhook signature
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = generateSignature(payload, secret)
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))
}

// Predefined webhook events with their schemas
export const WEBHOOK_EVENTS = {
  "order.created": {
    description: "Triggered when a new order is created",
    schema: {
      orderId: "string",
      customerId: "string",
      total: "number",
      currency: "string",
      items: "array",
      shippingAddress: "object",
      billingAddress: "object",
    },
  },
  "order.updated": {
    description: "Triggered when an order status changes",
    schema: {
      orderId: "string",
      previousStatus: "string",
      newStatus: "string",
      updatedAt: "string",
    },
  },
  "order.shipped": {
    description: "Triggered when an order is shipped",
    schema: {
      orderId: "string",
      trackingNumber: "string",
      carrier: "string",
      shippedAt: "string",
    },
  },
  "inventory.low_stock": {
    description: "Triggered when product inventory falls below threshold",
    schema: {
      productId: "string",
      sku: "string",
      currentQuantity: "number",
      threshold: "number",
    },
  },
  "customer.created": {
    description: "Triggered when a new customer registers",
    schema: {
      customerId: "string",
      email: "string",
      firstName: "string",
      lastName: "string",
      createdAt: "string",
    },
  },
  "payment.succeeded": {
    description: "Triggered when a payment is successfully processed",
    schema: {
      orderId: "string",
      paymentIntentId: "string",
      amount: "number",
      currency: "string",
    },
  },
  "payment.failed": {
    description: "Triggered when a payment fails",
    schema: {
      orderId: "string",
      paymentIntentId: "string",
      error: "string",
    },
  },
  "subscription.activated": {
    description: "Triggered when a subscription is activated",
    schema: {
      subscriptionId: "string",
      customerId: "string",
      planId: "string",
      status: "string",
    },
  },
  "subscription.canceled": {
    description: "Triggered when a subscription is canceled",
    schema: {
      subscriptionId: "string",
      customerId: "string",
      canceledAt: "string",
    },
  },
}
