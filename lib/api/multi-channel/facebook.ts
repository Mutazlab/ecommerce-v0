import { query } from "@/lib/database/connection"
import { sendWebhook } from "@/lib/webhooks/sender"

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID!
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET!
const FACEBOOK_API_VERSION = "v18.0"

interface FacebookProduct {
  id: string
  name: string
  description: string
  price: number
  currency: string
  availability: "in stock" | "out of stock"
  condition: "new" | "used" | "refurbished"
  brand: string
  category: string
  images: string[]
  url: string
}

// Get Facebook access token
async function getFacebookAccessToken(pageId: string): Promise<string> {
  try {
    const result = await query(
      "SELECT access_token FROM social_integrations WHERE platform = $1 AND page_id = $2 AND is_active = true",
      ["facebook", pageId],
    )

    if (result.rows.length === 0) {
      throw new Error("Facebook integration not found or inactive")
    }

    return result.rows[0].access_token
  } catch (error) {
    console.error("Facebook access token error:", error)
    throw new Error("Failed to get Facebook access token")
  }
}

// Sync product to Facebook catalog
export async function syncProductToFacebook(productId: string, pageId: string) {
  try {
    const accessToken = await getFacebookAccessToken(pageId)

    // Get product details from database
    const productResult = await query(
      `SELECT p.*, c.translations as category_translations 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = $1`,
      [productId],
    )

    if (productResult.rows.length === 0) {
      throw new Error("Product not found")
    }

    const product = productResult.rows[0]
    const facebookProduct: FacebookProduct = {
      id: product.id,
      name: product.translations.en_name || product.translations.ar_name,
      description: product.translations.en_description || product.translations.ar_description,
      price: product.price,
      currency: "USD",
      availability: product.inventory_quantity > 0 ? "in stock" : "out of stock",
      condition: "new",
      brand: product.brand || "Generic",
      category: product.category_translations?.en_name || "General",
      images: product.images || [],
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/products/${product.slug}`,
    }

    // Get catalog ID
    const catalogResult = await query(
      "SELECT catalog_id FROM social_integrations WHERE platform = $1 AND page_id = $2",
      ["facebook", pageId],
    )

    const catalogId = catalogResult.rows[0]?.catalog_id
    if (!catalogId) {
      throw new Error("Facebook catalog not configured")
    }

    // Create or update product in Facebook catalog
    const response = await fetch(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/${catalogId}/products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        retailer_id: facebookProduct.id,
        name: facebookProduct.name,
        description: facebookProduct.description,
        price: `${facebookProduct.price} ${facebookProduct.currency}`,
        availability: facebookProduct.availability,
        condition: facebookProduct.condition,
        brand: facebookProduct.brand,
        google_product_category: facebookProduct.category,
        image_url: facebookProduct.images[0],
        additional_image_urls: facebookProduct.images.slice(1),
        url: facebookProduct.url,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(`Facebook API error: ${result.error?.message || "Unknown error"}`)
    }

    // Update sync status in database
    await query(
      `INSERT INTO product_sync_status (product_id, platform, platform_product_id, last_synced, status)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
       ON CONFLICT (product_id, platform) 
       DO UPDATE SET platform_product_id = $3, last_synced = CURRENT_TIMESTAMP, status = $4`,
      [productId, "facebook", result.id, "synced"],
    )

    await sendWebhook("product.synced", {
      productId,
      platform: "facebook",
      platformProductId: result.id,
      status: "success",
    })

    return result
  } catch (error) {
    console.error("Facebook product sync error:", error)

    // Update sync status as failed
    await query(
      `INSERT INTO product_sync_status (product_id, platform, last_synced, status, error_message)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)
       ON CONFLICT (product_id, platform) 
       DO UPDATE SET last_synced = CURRENT_TIMESTAMP, status = $3, error_message = $4`,
      [productId, "facebook", "failed", error instanceof Error ? error.message : "Unknown error"],
    )

    throw error
  }
}

// Handle Facebook webhook events
export async function handleFacebookWebhook(event: any) {
  try {
    switch (event.object) {
      case "page":
        for (const entry of event.entry) {
          if (entry.messaging) {
            for (const message of entry.messaging) {
              await handleFacebookMessage(message)
            }
          }
        }
        break

      case "instagram":
        for (const entry of event.entry) {
          if (entry.messaging) {
            for (const message of entry.messaging) {
              await handleInstagramMessage(message)
            }
          }
        }
        break

      default:
        console.log(`Unhandled Facebook webhook object: ${event.object}`)
    }
  } catch (error) {
    console.error("Facebook webhook handling error:", error)
    throw error
  }
}

async function handleFacebookMessage(message: any) {
  // Handle Facebook Messenger messages
  // This could include order inquiries, product questions, etc.
  await sendWebhook("social.message_received", {
    platform: "facebook",
    senderId: message.sender.id,
    recipientId: message.recipient.id,
    message: message.message,
    timestamp: message.timestamp,
  })
}

async function handleInstagramMessage(message: any) {
  // Handle Instagram Direct messages
  await sendWebhook("social.message_received", {
    platform: "instagram",
    senderId: message.sender.id,
    recipientId: message.recipient.id,
    message: message.message,
    timestamp: message.timestamp,
  })
}

// Create Facebook Shop
export async function createFacebookShop(
  pageId: string,
  shopData: {
    name: string
    description: string
    website_url: string
    contact_email: string
  },
) {
  try {
    const accessToken = await getFacebookAccessToken(pageId)

    const response = await fetch(
      `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/commerce_merchant_settings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: shopData.name,
          description: shopData.description,
          website_url: shopData.website_url,
          contact_email: shopData.contact_email,
          checkout_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout`,
        }),
      },
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(`Facebook Shop creation error: ${result.error?.message || "Unknown error"}`)
    }

    // Store shop configuration
    await query(
      `UPDATE social_integrations 
       SET shop_id = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE platform = $2 AND page_id = $3`,
      [result.id, "facebook", pageId],
    )

    return result
  } catch (error) {
    console.error("Facebook Shop creation error:", error)
    throw error
  }
}

// Bulk sync products to Facebook
export async function bulkSyncProductsToFacebook(pageId: string, productIds?: string[]) {
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
        const result = await syncProductToFacebook(product.id, pageId)
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
      platform: "facebook",
      pageId,
      results: syncResults,
      totalProducts: products.length,
      successCount: syncResults.filter((r) => r.status === "success").length,
      failedCount: syncResults.filter((r) => r.status === "failed").length,
    })

    return syncResults
  } catch (error) {
    console.error("Facebook bulk sync error:", error)
    throw error
  }
}
