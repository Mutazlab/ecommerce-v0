import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Mock data for demo - in production, this would come from the database
    const integrations = [
      {
        id: "1",
        channel: "facebook",
        name: "Facebook Shop",
        isActive: true,
        lastSync: "2024-01-15T10:30:00Z",
        syncStatus: "success",
        productsCount: 125,
        ordersCount: 45,
      },
      {
        id: "2",
        channel: "instagram",
        name: "Instagram Shopping",
        isActive: true,
        lastSync: "2024-01-15T09:15:00Z",
        syncStatus: "success",
        productsCount: 98,
        ordersCount: 23,
      },
      {
        id: "3",
        channel: "amazon",
        name: "Amazon Marketplace",
        isActive: false,
        lastSync: null,
        syncStatus: "pending",
        productsCount: 0,
        ordersCount: 0,
      },
      {
        id: "4",
        channel: "ebay",
        name: "eBay Store",
        isActive: false,
        lastSync: null,
        syncStatus: "pending",
        productsCount: 0,
        ordersCount: 0,
      },
      {
        id: "5",
        channel: "pos",
        name: "Square POS",
        isActive: true,
        lastSync: "2024-01-15T11:45:00Z",
        syncStatus: "success",
        productsCount: 150,
        ordersCount: 78,
      },
    ]

    return NextResponse.json(integrations)
  } catch (error) {
    console.error("Failed to fetch integrations:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
