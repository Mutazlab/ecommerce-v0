interface FacebookProduct {
  id: string
  name: string
  description: string
  price: number
  images: string[]
  availability: "in stock" | "out of stock"
  condition: "new" | "used" | "refurbished"
  brand?: string
  category?: string
}

interface FacebookOrder {
  id: string
  status: string
  items: Array<{
    product_id: string
    quantity: number
    price: number
  }>
  buyer: {
    name: string
    email: string
  }
  shipping_address: {
    street1: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  created_time: string
}

export class FacebookIntegration {
  private accessToken: string
  private pageId: string

  constructor(accessToken: string, pageId: string) {
    this.accessToken = accessToken
    this.pageId = pageId
  }

  async syncProducts(products: FacebookProduct[]): Promise<boolean> {
    try {
      const catalogId = await this.getCatalogId()

      for (const product of products) {
        await this.createOrUpdateProduct(catalogId, product)
      }

      return true
    } catch (error) {
      console.error("Facebook product sync failed:", error)
      return false
    }
  }

  async getOrders(): Promise<FacebookOrder[]> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.pageId}/commerce_orders?access_token=${this.accessToken}`,
      )

      if (!response.ok) {
        throw new Error("Failed to fetch Facebook orders")
      }

      const data = await response.json()
      return data.data || []
    } catch (error) {
      console.error("Failed to fetch Facebook orders:", error)
      return []
    }
  }

  private async getCatalogId(): Promise<string> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${this.pageId}/product_catalogs?access_token=${this.accessToken}`,
    )

    if (!response.ok) {
      throw new Error("Failed to get catalog ID")
    }

    const data = await response.json()
    return data.data[0]?.id
  }

  private async createOrUpdateProduct(catalogId: string, product: FacebookProduct): Promise<void> {
    const productData = {
      name: product.name,
      description: product.description,
      price: `${product.price} USD`,
      currency: "USD",
      availability: product.availability,
      condition: product.condition,
      brand: product.brand,
      category: product.category,
      image_url: product.images[0],
      additional_image_urls: product.images.slice(1),
      retailer_id: product.id,
    }

    const response = await fetch(`https://graph.facebook.com/v18.0/${catalogId}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: this.accessToken,
        ...productData,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to sync product: ${error.error?.message}`)
    }
  }

  async updateInventory(productId: string, quantity: number): Promise<boolean> {
    try {
      const catalogId = await this.getCatalogId()

      const response = await fetch(`https://graph.facebook.com/v18.0/${catalogId}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: this.accessToken,
          retailer_id: productId,
          availability: quantity > 0 ? "in stock" : "out of stock",
          inventory: quantity,
        }),
      })

      return response.ok
    } catch (error) {
      console.error("Failed to update Facebook inventory:", error)
      return false
    }
  }

  async setupWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${this.pageId}/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: this.accessToken,
          object: "page",
          callback_url: webhookUrl,
          fields: ["commerce_orders"],
          verify_token: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
        }),
      })

      return response.ok
    } catch (error) {
      console.error("Failed to setup Facebook webhook:", error)
      return false
    }
  }
}

export async function createFacebookIntegration(credentials: {
  accessToken: string
  pageId: string
}): Promise<FacebookIntegration> {
  return new FacebookIntegration(credentials.accessToken, credentials.pageId)
}
