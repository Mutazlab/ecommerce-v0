import { query } from "@/lib/database/connection"
import { sendWebhook } from "@/lib/webhooks/sender"

interface POSSystem {
  id: string
  name: string
  type: "square" | "clover" | "lightspeed" | "shopify_pos"
  apiKey: string
  apiSecret?: string
  locationId?: string
  isActive: boolean
}

interface POSProduct {
  id: string
  name: string
  sku: string
  price: number
  inventory: number
  category?: string
}

interface POSOrder {
  id: string
  locationId: string
  customerId?: string
  items: Array<{
    productId: string
    quantity: number
    price: number
  }>
  totalAmount: number
  paymentMethod: string
  status: string
  createdAt: Date
}

// Square POS Integration
class SquarePOSIntegration {
  private apiKey: string
  private environment: "sandbox" | "production"
  private baseUrl: string

  constructor(apiKey: string, environment: "sandbox" | "production" = "sandbox") {
    this.apiKey = apiKey
    this.environment = environment
    this.baseUrl = environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com"
  }

  async syncProduct(product: any): Promise<any> {
    try {
      const squareProduct = {
        type: "ITEM",
        id: `#${product.sku}`,
        item_data: {
          name: product.translations?.en_name || product.name,
          description: product.translations?.en_description || product.description,
          category_id: product.category_id,
          variations: [
            {
              type: "ITEM_VARIATION",
              id: `#${product.sku}_variation`,
              item_variation_data: {
                item_id: `#${product.sku}`,
                name: "Regular",
                pricing_type: "FIXED_PRICING",
                price_money: {
                  amount: Math.round(product.price * 100), // Convert to cents
                  currency: "USD",
                },
                track_inventory: true,
                inventory_alert_type: "LOW_QUANTITY",
                inventory_alert_threshold: product.low_stock_threshold || 5,
              },
            },
          ],
        },
      }

      const response = await fetch(`${this.baseUrl}/v2/catalog/batch-upsert`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Square-Version": "2023-10-18",
        },
        body: JSON.stringify({
          idempotency_key: `sync_${product.id}_${Date.now()}`,
          batches: [
            {
              objects: [squareProduct],
            },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Square API error: ${error.errors?.[0]?.detail || "Unknown error"}`)
      }

      const result = await response.json()
      return result.objects?.[0]
    } catch (error) {
      console.error("Square product sync error:", error)
      throw error
    }
  }

  async updateInventory(sku: string, quantity: number, locationId: string): Promise<any> {
    try {
      // First, get the catalog object ID
      const searchResponse = await fetch(`${this.baseUrl}/v2/catalog/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Square-Version": "2023-10-18",
        },
        body: JSON.stringify({
          object_types: ["ITEM_VARIATION"],
          query: {
            exact_query: {
              attribute_name: "sku",
              attribute_value: sku,
            },
          },
        }),
      })

      const searchResult = await searchResponse.json()
      const variation = searchResult.objects?.[0]

      if (!variation) {
        throw new Error(`Product with SKU ${sku} not found in Square`)
      }

      // Update inventory
      const response = await fetch(`${this.baseUrl}/v2/inventory/changes/batch-create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Square-Version": "2023-10-18",
        },
        body: JSON.stringify({
          idempotency_key: `inventory_${sku}_${Date.now()}`,
          changes: [
            {
              type: "PHYSICAL_COUNT",
              physical_count: {
                catalog_object_id: variation.id,
                location_id: locationId,
                quantity: quantity.toString(),
                occurred_at: new Date().toISOString(),
              },
            },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Square inventory update error: ${error.errors?.[0]?.detail || "Unknown error"}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Square inventory update error:", error)
      throw error
    }
  }

  async getOrders(locationId: string, startTime?: string): Promise<POSOrder[]> {
    try {
      const url = `${this.baseUrl}/v2/orders/search`

      const searchQuery: any = {
        location_ids: [locationId],
        query: {
          sort: {
            sort_field: "CREATED_AT",
            sort_order: "DESC",
          },
        },
      }

      if (startTime) {
        searchQuery.query.filter = {
          date_time_filter: {
            created_at: {
              start_at: startTime,
            },
          },
        }
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Square-Version": "2023-10-18",
        },
        body: JSON.stringify(searchQuery),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Square orders fetch error: ${error.errors?.[0]?.detail || "Unknown error"}`)
      }

      const result = await response.json()
      return result.orders || []
    } catch (error) {
      console.error("Square orders fetch error:", error)
      throw error
    }
  }
}

// Clover POS Integration
class CloverPOSIntegration {
  private apiKey: string
  private merchantId: string
  private environment: "sandbox" | "production"
  private baseUrl: string

  constructor(apiKey: string, merchantId: string, environment: "sandbox" | "production" = "sandbox") {
    this.apiKey = apiKey
    this.merchantId = merchantId
    this.environment = environment
    this.baseUrl = environment === "production" ? "https://api.clover.com" : "https://apisandbox.dev.clover.com"
  }

  async syncProduct(product: any): Promise<any> {
    try {
      const cloverProduct = {
        name: product.translations?.en_name || product.name,
        code: product.sku,
        price: Math.round(product.price * 100), // Convert to cents
        priceType: "FIXED",
        defaultTaxRates: true,
        cost: product.cost_price ? Math.round(product.cost_price * 100) : undefined,
      }

      const response = await fetch(`${this.baseUrl}/v3/merchants/${this.merchantId}/items`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cloverProduct),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Clover API error: ${error.message || "Unknown error"}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Clover product sync error:", error)
      throw error
    }
  }

  async updateInventory(itemId: string, quantity: number): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/merchants/${this.merchantId}/item_stocks/${itemId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantity: quantity,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Clover inventory update error: ${error.message || "Unknown error"}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Clover inventory update error:", error)
      throw error
    }
  }

  async getOrders(startTime?: string): Promise<POSOrder[]> {
    try {
      let url = `${this.baseUrl}/v3/merchants/${this.merchantId}/orders`

      if (startTime) {
        const timestamp = new Date(startTime).getTime()
        url += `?filter=createdTime>=${timestamp}`
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Clover orders fetch error: ${error.message || "Unknown error"}`)
      }

      const result = await response.json()
      return result.elements || []
    } catch (error) {
      console.error("Clover orders fetch error:", error)
      throw error
    }
  }
}

// POS Integration Manager
export class POSIntegrationManager {
  private integrations: Map<string, any> = new Map()

  constructor() {
    this.loadIntegrations()
  }

  private async loadIntegrations() {
    try {
      const result = await query(`
        SELECT * FROM pos_integrations WHERE is_active = true
      `)

      for (const integration of result.rows) {
        switch (integration.type) {
          case "square":
            this.integrations.set(
              integration.id,
              new SquarePOSIntegration(integration.api_key, integration.environment || "sandbox"),
            )
            break
          case "clover":
            this.integrations.set(
              integration.id,
              new CloverPOSIntegration(
                integration.api_key,
                integration.merchant_id,
                integration.environment || "sandbox",
              ),
            )
            break
        }
      }
    } catch (error) {
      console.error("POS integrations loading error:", error)
    }
  }

  async syncProductToAllPOS(productId: string) {
    try {
      // Get product details
      const productResult = await query("SELECT * FROM products WHERE id = $1", [productId])

      if (productResult.rows.length === 0) {
        throw new Error("Product not found")
      }

      const product = productResult.rows[0]
      const results = []

      for (const [integrationId, integration] of this.integrations) {
        try {
          const result = await integration.syncProduct(product)
          results.push({ integrationId, status: "success", result })

          // Update sync status
          await query(
            `
            INSERT INTO pos_sync_status (product_id, integration_id, last_synced, status)
            VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
            ON CONFLICT (product_id, integration_id)
            DO UPDATE SET last_synced = CURRENT_TIMESTAMP, status = $3
          `,
            [productId, integrationId, "synced"],
          )
        } catch (error) {
          results.push({
            integrationId,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          })

          // Update sync status as failed
          await query(
            `
            INSERT INTO pos_sync_status (product_id, integration_id, last_synced, status, error_message)
            VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)
            ON CONFLICT (product_id, integration_id)
            DO UPDATE SET last_synced = CURRENT_TIMESTAMP, status = $3, error_message = $4
          `,
            [productId, integrationId, "failed", error instanceof Error ? error.message : "Unknown error"],
          )
        }
      }

      await sendWebhook("product.pos_synced", {
        productId,
        results,
        successCount: results.filter((r) => r.status === "success").length,
        failedCount: results.filter((r) => r.status === "failed").length,
      })

      return results
    } catch (error) {
      console.error("POS product sync error:", error)
      throw error
    }
  }

  async syncInventoryToAllPOS(productId: string, quantity: number) {
    try {
      const product = await query("SELECT sku FROM products WHERE id = $1", [productId])

      if (product.rows.length === 0) {
        throw new Error("Product not found")
      }

      const sku = product.rows[0].sku
      const results = []

      for (const [integrationId, integration] of this.integrations) {
        try {
          // Get POS-specific product ID
          const posProductResult = await query(
            `
            SELECT pos_product_id, location_id FROM pos_sync_status 
            WHERE product_id = $1 AND integration_id = $2 AND status = 'synced'
          `,
            [productId, integrationId],
          )

          if (posProductResult.rows.length === 0) {
            continue // Skip if product not synced to this POS
          }

          const posProductId = posProductResult.rows[0].pos_product_id
          const locationId = posProductResult.rows[0].location_id

          let result
          if (integration instanceof SquarePOSIntegration) {
            result = await integration.updateInventory(sku, quantity, locationId)
          } else if (integration instanceof CloverPOSIntegration) {
            result = await integration.updateInventory(posProductId, quantity)
          }

          results.push({ integrationId, status: "success", result })
        } catch (error) {
          results.push({
            integrationId,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }

      await sendWebhook("inventory.pos_synced", {
        productId,
        sku,
        quantity,
        results,
      })

      return results
    } catch (error) {
      console.error("POS inventory sync error:", error)
      throw error
    }
  }

  async importOrdersFromAllPOS() {
    try {
      const results = []

      for (const [integrationId, integration] of this.integrations) {
        try {
          // Get last import time
          const lastImportResult = await query(
            `
            SELECT last_import_at FROM pos_integrations WHERE id = $1
          `,
            [integrationId],
          )

          const lastImportTime = lastImportResult.rows[0]?.last_import_at

          let orders
          if (integration instanceof SquarePOSIntegration) {
            // Get location ID from integration config
            const configResult = await query(
              `
              SELECT location_id FROM pos_integrations WHERE id = $1
            `,
              [integrationId],
            )
            const locationId = configResult.rows[0]?.location_id

            orders = await integration.getOrders(locationId, lastImportTime?.toISOString())
          } else if (integration instanceof CloverPOSIntegration) {
            orders = await integration.getOrders(lastImportTime?.toISOString())
          }

          // Process and store orders
          for (const posOrder of orders || []) {
            await this.processPOSOrder(posOrder, integrationId)
          }

          // Update last import time
          await query(
            `
            UPDATE pos_integrations 
            SET last_import_at = CURRENT_TIMESTAMP 
            WHERE id = $1
          `,
            [integrationId],
          )

          results.push({
            integrationId,
            status: "success",
            ordersImported: orders?.length || 0,
          })
        } catch (error) {
          results.push({
            integrationId,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }

      return results
    } catch (error) {
      console.error("POS orders import error:", error)
      throw error
    }
  }

  private async processPOSOrder(posOrder: any, integrationId: string) {
    try {
      // Check if order already exists
      const existingOrder = await query(
        `
        SELECT id FROM orders 
        WHERE external_order_id = $1 AND platform = $2
      `,
        [posOrder.id, "pos"],
      )

      if (existingOrder.rows.length > 0) {
        return // Order already processed
      }

      // Create order in local database
      const orderResult = await query(
        `
        INSERT INTO orders (
          external_order_id, platform, order_number, status, payment_status,
          currency, total_amount, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `,
        [
          posOrder.id,
          "pos",
          posOrder.id,
          "completed", // POS orders are typically completed
          "paid", // POS orders are pre-paid
          "USD",
          posOrder.total_money?.amount ? posOrder.total_money.amount / 100 : 0,
          posOrder.created_at || new Date(),
          new Date(),
        ],
      )

      const orderId = orderResult.rows[0].id

      // Create order items
      for (const lineItem of posOrder.line_items || []) {
        // Find local product by catalog object ID or SKU
        const productResult = await query(
          `
          SELECT id, price FROM products 
          WHERE sku = $1 OR id IN (
            SELECT product_id FROM pos_sync_status 
            WHERE pos_product_id = $2 AND integration_id = $3
          )
        `,
          [lineItem.catalog_object_id, lineItem.catalog_object_id, integrationId],
        )

        const product = productResult.rows[0]

        await query(
          `
          INSERT INTO order_items (
            order_id, product_id, quantity, unit_price, total_price, product_snapshot
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
          [
            orderId,
            product?.id || null,
            Number.parseInt(lineItem.quantity || "1"),
            lineItem.base_price_money?.amount ? lineItem.base_price_money.amount / 100 : 0,
            lineItem.total_money?.amount ? lineItem.total_money.amount / 100 : 0,
            JSON.stringify(lineItem),
          ],
        )
      }

      await sendWebhook("order.pos_imported", {
        orderId,
        externalOrderId: posOrder.id,
        integrationId,
        totalAmount: posOrder.total_money?.amount ? posOrder.total_money.amount / 100 : 0,
      })
    } catch (error) {
      console.error("POS order processing error:", error)
    }
  }
}

// Initialize POS integration manager
export const posManager = new POSIntegrationManager()

// API functions
export async function syncProductToPOS(productId: string) {
  return await posManager.syncProductToAllPOS(productId)
}

export async function syncInventoryToPOS(productId: string, quantity: number) {
  return await posManager.syncInventoryToAllPOS(productId, quantity)
}

export async function importPOSOrders() {
  return await posManager.importOrdersFromAllPOS()
}
