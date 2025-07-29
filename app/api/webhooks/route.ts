import { type NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"

// Webhook handler for n8n automation and external integrations
export async function POST(request: NextRequest) {
  try {
    const headersList = headers()
    const signature = headersList.get("x-webhook-signature")
    const eventType = headersList.get("x-event-type")

    // Verify webhook signature (implement your signature verification logic)
    if (!verifyWebhookSignature(signature, await request.text())) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const body = await request.json()

    // Handle different webhook events
    switch (eventType) {
      case "order.created":
        await handleOrderCreated(body)
        break
      case "order.updated":
        await handleOrderUpdated(body)
        break
      case "inventory.low":
        await handleLowInventory(body)
        break
      case "customer.created":
        await handleCustomerCreated(body)
        break
      default:
        console.log(`Unhandled webhook event: ${eventType}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

function verifyWebhookSignature(signature: string | null, payload: string): boolean {
  // Implement your webhook signature verification logic here
  // This is a placeholder - use proper HMAC verification in production
  return true
}

async function handleOrderCreated(orderData: any) {
  // Trigger n8n workflow for new order processing
  // Send confirmation emails, update inventory, etc.
  console.log("New order created:", orderData.id)

  // Example: Trigger external automation
  await triggerN8nWorkflow("order-created", orderData)
}

async function handleOrderUpdated(orderData: any) {
  // Handle order status updates
  console.log("Order updated:", orderData.id, orderData.status)

  await triggerN8nWorkflow("order-updated", orderData)
}

async function handleLowInventory(inventoryData: any) {
  // Handle low inventory alerts
  console.log("Low inventory alert:", inventoryData.productId)

  await triggerN8nWorkflow("inventory-low", inventoryData)
}

async function handleCustomerCreated(customerData: any) {
  // Handle new customer registration
  console.log("New customer:", customerData.id)

  await triggerN8nWorkflow("customer-created", customerData)
}

async function triggerN8nWorkflow(workflowType: string, data: any) {
  try {
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL
    if (!n8nWebhookUrl) return

    await fetch(`${n8nWebhookUrl}/${workflowType}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.N8N_API_KEY}`,
      },
      body: JSON.stringify(data),
    })
  } catch (error) {
    console.error("Failed to trigger n8n workflow:", error)
  }
}
