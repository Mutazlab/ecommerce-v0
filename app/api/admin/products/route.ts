import { type NextRequest, NextResponse } from "next/server"
import { query, invalidateCache } from "@/lib/database/connection"
import { indexProduct } from "@/lib/elasticsearch/setup"
import { sendWebhook } from "@/lib/webhooks/sender"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""
    const status = searchParams.get("status") || "all"
    const featured = searchParams.get("featured") || "all"
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    const whereConditions = ["1=1"]
    const queryParams: any[] = []
    let paramIndex = 1

    // Search filter
    if (search) {
      whereConditions.push(`(
        p.translations->>'en_name' ILIKE $${paramIndex} OR
        p.translations->>'ar_name' ILIKE $${paramIndex} OR
        p.sku ILIKE $${paramIndex}
      )`)
      queryParams.push(`%${search}%`)
      paramIndex++
    }

    // Category filter
    if (category) {
      whereConditions.push(`p.category_id = $${paramIndex}`)
      queryParams.push(category)
      paramIndex++
    }

    // Status filter
    if (status !== "all") {
      whereConditions.push(`p.is_active = $${paramIndex}`)
      queryParams.push(status === "active")
      paramIndex++
    }

    // Featured filter
    if (featured !== "all") {
      whereConditions.push(`p.is_featured = $${paramIndex}`)
      queryParams.push(featured === "featured")
      paramIndex++
    }

    const whereClause = whereConditions.join(" AND ")

    const result = await query(
      `
      SELECT 
        p.*,
        c.translations as category_translations,
        COUNT(*) OVER() as total_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
      [...queryParams, limit, offset],
    )

    const products = result.rows.map((row) => ({
      ...row,
      category: row.category_translations
        ? {
            name: row.category_translations,
          }
        : null,
    }))

    return NextResponse.json({
      products,
      pagination: {
        total: result.rows[0]?.total_count || 0,
        limit,
        offset,
        hasMore: (result.rows[0]?.total_count || 0) > offset + limit,
      },
    })
  } catch (error) {
    console.error("Products fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const productData = await request.json()

    // Validate required fields
    const requiredFields = ["sku", "translations", "price"]
    for (const field of requiredFields) {
      if (!productData[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Generate slug from name
    const slug =
      productData.translations.en_name
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `product-${Date.now()}`

    const result = await query(
      `
      INSERT INTO products (
        sku, slug, category_id, translations, price, compare_price, cost_price,
        wholesale_price, pay_what_you_want, min_price, suggested_prices,
        weight, dimensions, requires_shipping, is_digital, digital_file_url,
        inventory_tracking, inventory_quantity, low_stock_threshold,
        allow_backorders, tax_exempt, tax_class, seo_title, seo_description,
        tags, is_active, is_featured
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      ) RETURNING *
    `,
      [
        productData.sku,
        slug,
        productData.category_id || null,
        productData.translations,
        productData.price,
        productData.compare_price || null,
        productData.cost_price || null,
        productData.wholesale_price || null,
        productData.pay_what_you_want || false,
        productData.min_price || null,
        productData.suggested_prices || [],
        productData.weight || null,
        productData.dimensions || null,
        productData.requires_shipping !== false,
        productData.is_digital || false,
        productData.digital_file_url || null,
        productData.inventory_tracking !== false,
        productData.inventory_quantity || 0,
        productData.low_stock_threshold || 5,
        productData.allow_backorders || false,
        productData.tax_exempt || false,
        productData.tax_class || null,
        productData.seo_title || {},
        productData.seo_description || {},
        productData.tags || [],
        productData.is_active !== false,
        productData.is_featured || false,
      ],
    )

    const product = result.rows[0]

    // Index in Elasticsearch
    await indexProduct(product)

    // Invalidate cache
    await invalidateCache("products:*")

    // Send webhook
    await sendWebhook("product.created", {
      productId: product.id,
      sku: product.sku,
      name: product.translations,
      price: product.price,
      createdAt: product.created_at,
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error("Product creation error:", error)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
