import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database/connection"
import { sendWebhook } from "@/lib/webhooks/sender"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status, payment_status, fulfillment_status, tracking_number, notes } = await request.json()
    const orderId = params.id

    // Get current order data
    const currentOrder = await query("SELECT * FROM orders WHERE id = $1", [orderId])

    if (currentOrder.rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const current = currentOrder.rows[0]
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (status && status !== current.status) {
      updates.push(`status = $${paramIndex}`)
      values.push(status)
      paramIndex++
    }

    if (payment_status && payment_status !== current.payment_status) {
      updates.push(`payment_status = $${paramIndex}`)
      values.push(payment_status)
      paramIndex++
    }

    if (fulfillment_status && fulfillment_status !== current.fulfillment_status) {
      updates.push(`fulfillment_status = $${paramIndex}`)
      values.push(fulfillment_status)
      paramIndex++
    }

    if (tracking_number) {
      updates.push(`tracking_number = $${paramIndex}`)
      values.push(tracking_number)
      paramIndex++
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`)
      values.push(notes)
      paramIndex++
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(orderId)

    const result = await query(
      `
      UPDATE orders 
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
      values,
    )

    const updatedOrder = result.rows[0]

    // Send webhooks for status changes
    if (status && status !== current.status) {
      await sendWebhook("order.status_updated", {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.order_number,
        previousStatus: current.status,
        newStatus: status,
        updatedAt: updatedOrder.updated_at,
      })

      // Special webhook for shipped orders
      if (status === "shipped" && tracking_number) {
        await sendWebhook("order.shipped", {
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.order_number,
          trackingNumber: tracking_number,
          shippedAt: updatedOrder.updated_at,
        })
      }
    }

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error("Order update error:", error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}
