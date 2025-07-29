import { NextResponse } from "next/server"
import { getProducts } from "@/lib/api/products"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") ? Number.parseInt(searchParams.get("limit")!) : undefined
    const categoryId = searchParams.get("category") || undefined
    const search = searchParams.get("search") || undefined
    const minPrice = searchParams.get("minPrice") ? Number.parseFloat(searchParams.get("minPrice")!) : undefined
    const maxPrice = searchParams.get("maxPrice") ? Number.parseFloat(searchParams.get("maxPrice")!) : undefined

    const products = await getProducts({
      limit,
      categoryId,
      search,
      minPrice,
      maxPrice,
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error("Error fetching products:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}
