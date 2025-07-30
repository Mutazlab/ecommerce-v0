import crypto from "crypto"

interface AmazonProduct {
  sku: string
  title: string
  description: string
  price: number
  quantity: number
  images: string[]
  category: string
  brand?: string
  weight?: number
  dimensions?: {
    length: number
    width: number
    height: number
  }
}

interface AmazonOrder {
  AmazonOrderId: string
  OrderStatus: string
  PurchaseDate: string
  OrderTotal: {
    Amount: string
    CurrencyCode: string
  }
  ShippingAddress: {
    Name: string
    AddressLine1: string
    City: string
    StateOrRegion: string
    PostalCode: string
    CountryCode: string
  }
  OrderItems: Array<{
    ASIN: string
    SellerSKU: string
    OrderItemId: string
    Title: string
    QuantityOrdered: number
    ItemPrice: {
      Amount: string
      CurrencyCode: string
    }
  }>
}

export class AmazonIntegration {
  private accessKey: string
  private secretKey: string
  private marketplaceId: string
  private sellerId: string
  private region: string
  private endpoint: string

  constructor(config: {
    accessKey: string
    secretKey: string
    marketplaceId: string
    sellerId: string
    region?: string
  }) {
    this.accessKey = config.accessKey
    this.secretKey = config.secretKey
    this.marketplaceId = config.marketplaceId
    this.sellerId = config.sellerId
    this.region = config.region || "us-east-1"
    this.endpoint = "https://sellingpartnerapi-na.amazon.com"
  }

  async syncProducts(products: AmazonProduct[]): Promise<boolean> {
    try {
      const feedDocument = this.createProductFeed(products)
      const feedId = await this.submitFeed(feedDocument, "POST_PRODUCT_DATA")

      // Monitor feed processing status
      const isProcessed = await this.waitForFeedProcessing(feedId)
      return isProcessed
    } catch (error) {
      console.error("Amazon product sync failed:", error)
      return false
    }
  }

  async getOrders(createdAfter?: Date): Promise<AmazonOrder[]> {
    try {
      const params = new URLSearchParams({
        MarketplaceIds: this.marketplaceId,
        CreatedAfter: (createdAfter || new Date(Date.now() - 24 * 60 * 60 * 1000)).toISOString(),
      })

      const response = await this.makeRequest("GET", `/orders/v0/orders?${params}`)

      if (!response.ok) {
        throw new Error("Failed to fetch Amazon orders")
      }

      const data = await response.json()
      const orders = data.payload?.Orders || []

      // Fetch order items for each order
      for (const order of orders) {
        const itemsResponse = await this.makeRequest("GET", `/orders/v0/orders/${order.AmazonOrderId}/orderItems`)

        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json()
          order.OrderItems = itemsData.payload?.OrderItems || []
        }
      }

      return orders
    } catch (error) {
      console.error("Failed to fetch Amazon orders:", error)
      return []
    }
  }

  async updateInventory(sku: string, quantity: number): Promise<boolean> {
    try {
      const feedDocument = this.createInventoryFeed([{ sku, quantity }])
      const feedId = await this.submitFeed(feedDocument, "POST_INVENTORY_AVAILABILITY_DATA")

      const isProcessed = await this.waitForFeedProcessing(feedId)
      return isProcessed
    } catch (error) {
      console.error("Failed to update Amazon inventory:", error)
      return false
    }
  }

  private createProductFeed(products: AmazonProduct[]): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>${this.sellerId}</MerchantIdentifier>
  </Header>
  <MessageType>Product</MessageType>`

    products.forEach((product, index) => {
      xml += `
  <Message>
    <MessageID>${index + 1}</MessageID>
    <OperationType>Update</OperationType>
    <Product>
      <SKU>${product.sku}</SKU>
      <StandardProductID>
        <Type>UPC</Type>
        <Value>123456789012</Value>
      </StandardProductID>
      <ProductTaxCode>A_GEN_NOTAX</ProductTaxCode>
      <DescriptionData>
        <Title>${product.title}</Title>
        <Brand>${product.brand || "Generic"}</Brand>
        <Description>${product.description}</Description>
        <BulletPoint>${product.description.substring(0, 100)}</BulletPoint>
        <MSRP currency="USD">${product.price}</MSRP>
        <Manufacturer>${product.brand || "Generic"}</Manufacturer>
      </DescriptionData>
      <ProductData>
        <Health>
          <ProductType>
            <HealthMisc>
              <Ingredients>${product.description}</Ingredients>
            </HealthMisc>
          </ProductType>
        </Health>
      </ProductData>
    </Product>
  </Message>`
    })

    xml += `
</AmazonEnvelope>`

    return xml
  }

  private createInventoryFeed(items: Array<{ sku: string; quantity: number }>): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>${this.sellerId}</MerchantIdentifier>
  </Header>
  <MessageType>Inventory</MessageType>`

    items.forEach((item, index) => {
      xml += `
  <Message>
    <MessageID>${index + 1}</MessageID>
    <OperationType>Update</OperationType>
    <Inventory>
      <SKU>${item.sku}</SKU>
      <Quantity>${item.quantity}</Quantity>
    </Inventory>
  </Message>`
    })

    xml += `
</AmazonEnvelope>`

    return xml
  }

  private async submitFeed(feedDocument: string, feedType: string): Promise<string> {
    // Create feed document
    const createDocResponse = await this.makeRequest("POST", "/feeds/2021-06-30/documents", {
      contentType: "text/xml; charset=UTF-8",
    })

    if (!createDocResponse.ok) {
      throw new Error("Failed to create feed document")
    }

    const docData = await createDocResponse.json()
    const { feedDocumentId, url } = docData.payload

    // Upload feed content
    await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "text/xml; charset=UTF-8",
      },
      body: feedDocument,
    })

    // Submit feed
    const submitResponse = await this.makeRequest("POST", "/feeds/2021-06-30/feeds", {
      feedType,
      marketplaceIds: [this.marketplaceId],
      inputFeedDocumentId: feedDocumentId,
    })

    if (!submitResponse.ok) {
      throw new Error("Failed to submit feed")
    }

    const submitData = await submitResponse.json()
    return submitData.payload.feedId
  }

  private async waitForFeedProcessing(feedId: string, maxAttempts = 10): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await this.makeRequest("GET", `/feeds/2021-06-30/feeds/${feedId}`)

      if (response.ok) {
        const data = await response.json()
        const processingStatus = data.payload.processingStatus

        if (processingStatus === "DONE") {
          return true
        } else if (processingStatus === "FATAL") {
          return false
        }
      }

      // Wait 30 seconds before next check
      await new Promise((resolve) => setTimeout(resolve, 30000))
    }

    return false
  }

  private async makeRequest(method: string, path: string, body?: any): Promise<Response> {
    const timestamp = new Date().toISOString()
    const headers: Record<string, string> = {
      "x-amz-access-token": process.env.AMAZON_LWA_ACCESS_TOKEN || "",
      "x-amz-date": timestamp,
      host: "sellingpartnerapi-na.amazon.com",
    }

    if (body && method !== "GET") {
      headers["content-type"] = "application/json"
    }

    // Create signature (simplified - in production, use AWS SDK)
    const signature = this.createSignature(method, path, headers, body ? JSON.stringify(body) : "")
    headers["authorization"] = signature

    return fetch(`${this.endpoint}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  private createSignature(method: string, path: string, headers: Record<string, string>, body: string): string {
    // Simplified signature creation - in production, use proper AWS Signature V4
    const stringToSign = `${method}\n${path}\n${JSON.stringify(headers)}\n${body}`
    const signature = crypto.createHmac("sha256", this.secretKey).update(stringToSign).digest("hex")

    return `AWS4-HMAC-SHA256 Credential=${this.accessKey}/20240101/${this.region}/execute-api/aws4_request, SignedHeaders=host;x-amz-date, Signature=${signature}`
  }
}

export async function createAmazonIntegration(credentials: {
  accessKey: string
  secretKey: string
  marketplaceId: string
  sellerId: string
  region?: string
}): Promise<AmazonIntegration> {
  return new AmazonIntegration(credentials)
}
