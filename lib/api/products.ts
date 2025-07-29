import type { Product } from "@/lib/types"

// Mock data - in a real app, this would come from your database
const mockProducts: Product[] = [
  {
    id: "1",
    name: "Wireless Bluetooth Headphones",
    description: "High-quality wireless headphones with noise cancellation and 30-hour battery life.",
    price: 199.99,
    comparePrice: 249.99,
    images: ["/placeholder.svg?height=400&width=400"],
    category: "electronics",
    slug: "wireless-bluetooth-headphones",
    inventory: 25,
    sku: "WBH-001",
    tags: ["electronics", "audio", "wireless"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    name: "Organic Cotton T-Shirt",
    description: "Comfortable and sustainable organic cotton t-shirt in various colors.",
    price: 29.99,
    images: ["/placeholder.svg?height=400&width=400"],
    category: "clothing",
    slug: "organic-cotton-t-shirt",
    inventory: 50,
    sku: "OCT-001",
    tags: ["clothing", "organic", "cotton"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "3",
    name: "Smart Fitness Watch",
    description: "Advanced fitness tracking with heart rate monitor, GPS, and smartphone integration.",
    price: 299.99,
    comparePrice: 349.99,
    images: ["/placeholder.svg?height=400&width=400"],
    category: "electronics",
    slug: "smart-fitness-watch",
    inventory: 15,
    sku: "SFW-001",
    tags: ["electronics", "fitness", "wearable"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "4",
    name: "Ceramic Coffee Mug Set",
    description: "Set of 4 handcrafted ceramic coffee mugs perfect for your morning routine.",
    price: 39.99,
    images: ["/placeholder.svg?height=400&width=400"],
    category: "home-garden",
    slug: "ceramic-coffee-mug-set",
    inventory: 30,
    sku: "CCM-001",
    tags: ["home", "kitchen", "ceramic"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "5",
    name: "Yoga Mat Premium",
    description: "Non-slip premium yoga mat with excellent grip and cushioning for all yoga practices.",
    price: 79.99,
    images: ["/placeholder.svg?height=400&width=400"],
    category: "sports",
    slug: "yoga-mat-premium",
    inventory: 20,
    sku: "YMP-001",
    tags: ["sports", "yoga", "fitness"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "6",
    name: "Leather Crossbody Bag",
    description: "Stylish genuine leather crossbody bag with multiple compartments.",
    price: 149.99,
    comparePrice: 199.99,
    images: ["/placeholder.svg?height=400&width=400"],
    category: "accessories",
    slug: "leather-crossbody-bag",
    inventory: 12,
    sku: "LCB-001",
    tags: ["accessories", "leather", "bag"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

interface GetProductsParams {
  limit?: number
  categoryId?: string
  search?: string
  minPrice?: number
  maxPrice?: number
}

export async function getProducts(params: GetProductsParams = {}): Promise<Product[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100))

  let filteredProducts = [...mockProducts]

  // Apply filters
  if (params.categoryId) {
    filteredProducts = filteredProducts.filter((product) => product.category === params.categoryId)
  }

  if (params.search) {
    const searchLower = params.search.toLowerCase()
    filteredProducts = filteredProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(searchLower) ||
        product.description.toLowerCase().includes(searchLower) ||
        product.tags.some((tag) => tag.toLowerCase().includes(searchLower)),
    )
  }

  if (params.minPrice !== undefined) {
    filteredProducts = filteredProducts.filter((product) => product.price >= params.minPrice!)
  }

  if (params.maxPrice !== undefined) {
    filteredProducts = filteredProducts.filter((product) => product.price <= params.maxPrice!)
  }

  // Apply limit
  if (params.limit) {
    filteredProducts = filteredProducts.slice(0, params.limit)
  }

  return filteredProducts
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  await new Promise((resolve) => setTimeout(resolve, 100))
  return mockProducts.find((product) => product.slug === slug) || null
}

export async function getProductById(id: string): Promise<Product | null> {
  await new Promise((resolve) => setTimeout(resolve, 100))
  return mockProducts.find((product) => product.id === id) || null
}
