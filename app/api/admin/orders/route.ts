import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database/connection"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const paymentStatus = searchParams.get("payment_status")
    const customerId = searchParams.get("customer_id")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    const whereConditions = ["1=1"]
    const queryParams: any[] = []
    let paramIndex = 1

    if (status && status !== "all") {
      whereConditions.push(`o.status = $${paramIndex}`)
      queryParams.push(status)
      paramIndex++
    }

    if (paymentStatus) {
      whereConditions.push(`o.payment_status = $${paramIndex}`)
      queryParams.push(paymentStatus)
      paramIndex++
    }

    if (customerId) {
      whereConditions.push(`o.user_id = $${paramIndex}`)
      queryParams.push(customerId)
      paramIndex++
    }

    const whereClause = whereConditions.join(" AND ")

    const result = await query(
      `
      SELECT 
        o.*,
        u.first_name,
        u.last_name,
        u.email,
        COUNT(oi.id) as items_count,
        COUNT(*) OVER() as total_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE ${whereClause}
      GROUP BY o.id, u.first_name, u.last_name, u.email
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
      [...queryParams, limit, offset],
    )

    const orders = result.rows.map((row) => ({
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      payment_status: row.payment_status,
      total_amount: Number.parseFloat(row.total_amount),
      currency: row.currency,
      created_at: row.created_at,
      items_count: Number.parseInt(row.items_count),
      customer: {
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
      },
    }))

    return NextResponse.json({
      orders,
      pagination: {
        total: result.rows[0]?.total_count || 0,
        limit,
        offset,
        hasMore: (result.rows[0]?.total_count || 0) > offset + limit,
      },
    })
  } catch (error) {
    console.error("Orders fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}
