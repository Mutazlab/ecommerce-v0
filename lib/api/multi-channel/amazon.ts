import { query } from "@/lib/database/connection"
import { sendWebhook } from "@/lib/webhooks/sender"
import crypto from "crypto"

const AMAZON_ACCESS_KEY = process.env.AMAZON_ACCESS_KEY!
const AMAZON_SECRET_KEY = process.env.AMAZON_SECRET_KEY!
const AMAZON_MARKETPLACE_ID = process.env.AMAZON_MARKETPLACE_ID!
const AMAZON_SELLER_ID = process.env.AMAZON_SELLER_ID!
const AMAZON_API_VERSION = "2021-06-30"

interface AmazonProduct {
  sku: string
  productType: string
  attributes: {
    item_name: string
    description: string
    brand: string
    manufacturer: string
    item_type_keyword: string
    price: number
    currency: string
    quantity: number
    condition_type: string
    main_image_url: string
    other_image_urls?: string[]
    bullet_points?: string[]
    search_terms?: string[]
  }
}

// Generate Amazon API signature
function generateAmazonSignature(
  method: string,
  uri: string,
  queryString: string,
  payload: string,
  timestamp: string,
): string {
  const canonicalRequest = [
    method,
    uri,
    queryString,
    "host:sellingpartnerapi-na.amazon.com",
    "x-amz-date:" + timestamp,
    "",
    "host;x-amz-date",
    crypto.createHash("sha256").update(payload).digest("hex"),
  ].join("\n")

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    timestamp.substr(0, 8) + "/us-east-1/execute-api/aws4_request",
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n")

  const signingKey = crypto
    .createHmac("sha256", "AWS4" + AMAZON_SECRET_KEY)
    .update(timestamp.substr(0, 8))
    .digest()

  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex")

  return signature
}

// Make authenticated request to Amazon SP-API
async function makeAmazonAPIRequest(endpoint: string, method = "GET", payload?: any): Promise<any> {
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "")
  const payloadString = payload ? JSON.stringify(payload) : ""

  const signature = generateAmazonSignature(method, endpoint, "", payloadString, timestamp)

  const response = await fetch(`https://sellingpartnerapi-na.amazon.com${endpoint}`, {
    method,
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${AMAZON_ACCESS_KEY}/${timestamp.substr(0, 8)}/us-east-1/execute-api/aws4_request, SignedHeaders=host;x-amz-date, Signature=${signature}`,
      "x-amz-date": timestamp,
      "x-amz-access-token": process.env.AMAZON_LWA_ACCESS_TOKEN!,
      "Content-Type": "application/json",
    },
    body: payloadString || undefined,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Amazon API error: ${error.errors?.[0]?.message || "Unknown error"}`)
  }

  return response.json()
}

// Sync product to Amazon
export async function syncProductToAmazon(productId: string) {
  try {
    // Get product details from database
    const productResult = await query(
      `SELECT p.*, c.translations as category_translations,
              pi.url as image_url
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
       WHERE p.id = $1`,
      [productId],
    )

    if (productResult.rows.length === 0) {
      throw new Error("Product not found")
    }

    const product = productResult.rows[0]

    // Get all product images
    const imagesResult = await query("SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order", [
      productId,
    ])

    const images = imagesResult.rows.map((row) => row.url)

    const amazonProduct: AmazonProduct = {
      sku: product.sku,
      productType: "PRODUCT", // This should be mapped based on category
      attributes: {
        item_name: product.translations.en_name || product.translations.ar_name,
        description: product.translations.en_description || product.translations.ar_description,
        brand: product.brand || "Generic",
        manufacturer: product.manufacturer || product.brand || "Generic",
        item_type_keyword: product.category_translations?.en_name || "General",
        price: product.price,
        currency: "USD",
        quantity: product.inventory_quantity,
        condition_type: "New",
        main_image_url: images[0] || "",
        other_image_urls: images.slice(1),
        bullet_points: product.features || [],
        search_terms: product.tags || [],
      },
    }

    // Create listing on Amazon
    const listingPayload = {
      productType: amazonProduct.productType,
      patches: [
        {
          op: "replace",
          path: "/attributes",
          value: amazonProduct.attributes,
        },
      ],
    }

    const result = await makeAmazonAPIRequest(
      `/listings/2021-08-01/items/${AMAZON_SELLER_ID}/${amazonProduct.sku}?marketplaceIds=${AMAZON_MARKETPLACE_ID}`,
      "PATCH",
      listingPayload,
    )

    // Update sync status in database
    await query(
      `INSERT INTO product_sync_status (product_id, platform, platform_product_id, last_synced, status)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
       ON CONFLICT (product_id, platform) 
       DO UPDATE SET platform_product_id = $3, last_synced = CURRENT_TIMESTAMP, status = $4`,
      [productId, "amazon", amazonProduct.sku, "synced"],
    )

    await sendWebhook("product.synced", {
      productId,
      platform: "amazon",
      platformProductId: amazonProduct.sku,
      status: "success",
    })

    return result
  } catch (error) {
    console.error("Amazon product sync error:", error)

    // Update sync status as failed
    await query(
      `INSERT INTO product_sync_status (product_id, platform, last_synced, status, error_message)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)
       ON CONFLICT (product_id, platform) 
       DO UPDATE SET last_synced = CURRENT_TIMESTAMP, status = $3, error_message = $4`,
      [productId, "amazon", "failed", error instanceof Error ? error.message : "Unknown error"],
    )

    throw error
  }
}

// Get Amazon orders
export async function getAmazonOrders(createdAfter?: string) {
  try {
    let endpoint = `/orders/v0/orders?MarketplaceIds=${AMAZON_MARKETPLACE_ID}`

    if (createdAfter) {
      endpoint += `&CreatedAfter=${createdAfter}`
    }

    const result = await makeAmazonAPIRequest(endpoint)

    // Process and store orders in local database
    for (const amazonOrder of result.payload.Orders) {
      await processAmazonOrder(amazonOrder)
    }

    return result.payload.Orders
  } catch (error) {
    console.error("Amazon orders fetch error:", error)
    throw error
  }
}

// Process Amazon order and store in local database
async function processAmazonOrder(amazonOrder: any) {
  try {
    // Check if order already exists
    const existingOrder = await query("SELECT id FROM orders WHERE external_order_id = $1 AND platform = $2", [
      amazonOrder.AmazonOrderId,
      "amazon",
    ])

    if (existingOrder.rows.length > 0) {
      return // Order already processed
    }

    // Get order items
    const orderItemsResult = await makeAmazonAPIRequest(`/orders/v0/orders/${amazonOrder.AmazonOrderId}/orderItems`)

    const orderItems = orderItemsResult.payload.OrderItems

    // Create order in local database
    const orderResult = await query(
      `INSERT INTO orders (
        external_order_id, platform, order_number, status, payment_status,
        currency, total_amount, shipping_address, billing_address,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        amazonOrder.AmazonOrderId,
        "amazon",
        amazonOrder.AmazonOrderId,
        amazonOrder.OrderStatus.toLowerCase(),
        "paid", // Amazon orders are pre-paid
        amazonOrder.OrderTotal?.CurrencyCode || "USD",
        Number.parseFloat(amazonOrder.OrderTotal?.Amount || "0"),
        JSON.stringify(amazonOrder.ShippingAddress),
        JSON.stringify(amazonOrder.ShippingAddress), // Use shipping as billing for Amazon
        amazonOrder.PurchaseDate,
        new Date(),
      ],
    )

    const orderId = orderResult.rows[0].id

    // Create order items
    for (const item of orderItems) {
      // Find local product by SKU
      const productResult = await query("SELECT id, price FROM products WHERE sku = $1", [item.SellerSKU])

      const product = productResult.rows[0]

      await query(
        `INSERT INTO order_items (
          order_id, product_id, quantity, unit_price, total_price, product_snapshot
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          product?.id || null,
          Number.parseInt(item.QuantityOrdered),
          Number.parseFloat(item.ItemPrice?.Amount || "0"),
          Number.parseFloat(item.ItemPrice?.Amount || "0") * Number.parseInt(item.QuantityOrdered),
          JSON.stringify(item),
        ],
      )
    }

    await sendWebhook("order.imported", {
      orderId,
      platform: "amazon",
      externalOrderId: amazonOrder.AmazonOrderId,
      totalAmount: Number.parseFloat(amazonOrder.OrderTotal?.Amount || "0"),
      currency: amazonOrder.OrderTotal?.CurrencyCode || "USD",
    })
  } catch (error) {
    console.error("Amazon order processing error:", error)
    throw error
  }
}

// Update Amazon inventory
export async function updateAmazonInventory(sku: string, quantity: number) {
  try {
    const payload = {
      feeds: [
        {
          marketplaceIds: [AMAZON_MARKETPLACE_ID],
          feedType: "POST_INVENTORY_AVAILABILITY_DATA",
          inputFeedDocumentId: "temp-doc-id", // This would be generated
        },
      ],
    }

    // In a real implementation, you would need to:
    // 1. Create a feed document
    // 2. Upload inventory data to the document
    // 3. Submit the feed
    // 4. Monitor feed processing status

    const result = await makeAmazonAPIRequest("/feeds/2021-06-30/feeds", "POST", payload)

    await sendWebhook("inventory.updated", {
      platform: "amazon",
      sku,
      quantity,
      feedId: result.feedId,
    })

    return result
  } catch (error) {
    console.error("Amazon inventory update error:", error)
    throw error
  }
}

// Bulk sync products to Amazon
export async function bulkSyncProductsToAmazon(productIds?: string[]) {
  try {
    let query_text = `
      SELECT id FROM products 
      WHERE is_active = true
    `
    let params: any[] = []

    if (productIds && productIds.length > 0) {
      query_text += ` AND id = ANY($1)`
      params = [productIds]
    }

    const result = await query(query_text, params)
    const products = result.rows

    const syncResults = []

    for (const product of products) {
      try {
        const result = await syncProductToAmazon(product.id)
        syncResults.push({ productId: product.id, status: "success", result })
      } catch (error) {
        syncResults.push({
          productId: product.id,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    await sendWebhook("products.bulk_synced", {
      platform: "amazon",
      results: syncResults,
      totalProducts: products.length,
      successCount: syncResults.filter((r) => r.status === "success").length,
      failedCount: syncResults.filter((r) => r.status === "failed").length,
    })

    return syncResults
  } catch (error) {
    console.error("Amazon bulk sync error:", error)
    throw error
  }
}
