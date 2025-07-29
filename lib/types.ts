export interface Product {
  id: string
  name: string
  description: string
  price: number
  comparePrice?: number
  images: string[]
  category: string
  slug: string
  inventory: number
  sku: string
  weight?: number
  dimensions?: {
    length: number
    width: number
    height: number
  }
  tags: string[]
  seoTitle?: string
  seoDescription?: string
  createdAt: Date
  updatedAt: Date
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image: string
}

export interface User {
  id: string
  email: string
  name: string
  role: "customer" | "admin" | "staff"
  avatar?: string
}

export interface Order {
  id: string
  userId: string
  items: CartItem[]
  total: number
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  shippingAddress: Address
  billingAddress: Address
  paymentMethod: string
  createdAt: Date
  updatedAt: Date
}

export interface Address {
  firstName: string
  lastName: string
  company?: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
  phone?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image?: string
  parentId?: string
  children?: Category[]
}
