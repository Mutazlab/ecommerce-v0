import { type NextRequest, NextResponse } from "next/server"
import { getProducts } from "@/lib/api/products"

/**
 * @swagger
 * /api/developer/products:
 *   get:
 *     summary: Get products with advanced filtering
 *     description: Retrieve products with comprehensive filtering options for developers
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of products to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of products to skip
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: boolean
 *         description: Filter by stock availability
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const limit = searchParams.get("limit") ? Number.parseInt(searchParams.get("limit")!) : 20
    const offset = searchParams.get("offset") ? Number.parseInt(searchParams.get("offset")!) : 0
    const category = searchParams.get("category") || undefined
    const minPrice = searchParams.get("minPrice") ? Number.parseFloat(searchParams.get("minPrice")!) : undefined
    const maxPrice = searchParams.get("maxPrice") ? Number.parseFloat(searchParams.get("maxPrice")!) : undefined
    const inStock = searchParams.get("inStock") === "true"

    const allProducts = await getProducts({
      categoryId: category,
      minPrice,
      maxPrice,
    })

    // Apply stock filter
    const filteredProducts = inStock ? allProducts.filter((product) => product.inventory > 0) : allProducts

    // Apply pagination
    const paginatedProducts = filteredProducts.slice(offset, offset + limit)

    const response = {
      products: paginatedProducts,
      pagination: {
        total: filteredProducts.length,
        limit,
        offset,
        hasMore: offset + limit < filteredProducts.length,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Developer API error:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}

/**
 * @swagger
 * /api/developer/products:
 *   post:
 *     summary: Create a new product
 *     description: Create a new product (admin access required)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProductRequest'
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Invalid request data
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !(await verifyAdminAccess(authHeader))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const productData = await request.json()

    // Validate required fields
    const requiredFields = ["name", "description", "price", "category"]
    for (const field of requiredFields) {
      if (!productData[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Create product (implement your product creation logic)
    const newProduct = await createProduct(productData)

    // Trigger webhook for product creation
    await triggerWebhook("product.created", newProduct)

    return NextResponse.json(newProduct, { status: 201 })
  } catch (error) {
    console.error("Product creation error:", error)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}

async function verifyAdminAccess(authHeader: string): Promise<boolean> {
  // Implement your admin authentication logic here
  // This is a placeholder - use proper JWT verification in production
  return authHeader.startsWith("Bearer ")
}

async function createProduct(productData: any) {
  // Implement product creation logic
  // This would typically interact with your database
  return {
    id: Date.now().toString(),
    ...productData,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

async function triggerWebhook(eventType: string, data: any) {
  // Trigger webhook for external integrations
  try {
    const webhookUrl = process.env.WEBHOOK_URL
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Event-Type": eventType,
        },
        body: JSON.stringify(data),
      })
    }
  } catch (error) {
    console.error("Webhook trigger failed:", error)
  }
}
