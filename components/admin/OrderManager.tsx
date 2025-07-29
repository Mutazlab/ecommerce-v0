"use client"

import { useState, useEffect } from "react"
import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/contexts/I18nContext"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Order {
  id: string
  order_number: string
  customer: {
    first_name: string
    last_name: string
    email: string
  }
  status: string
  payment_status: string
  total_amount: number
  currency: string
  created_at: string
  items_count: number
}

const ORDER_STATUSES = [
  { value: "pending", label: "Pending", color: "secondary" },
  { value: "processing", label: "Processing", color: "default" },
  { value: "shipped", label: "Shipped", color: "default" },
  { value: "delivered", label: "Delivered", color: "default" },
  { value: "cancelled", label: "Cancelled", color: "destructive" },
]

const PAYMENT_STATUSES = [
  { value: "pending", label: "Pending", color: "secondary" },
  { value: "paid", label: "Paid", color: "default" },
  { value: "failed", label: "Failed", color: "destructive" },
  { value: "refunded", label: "Refunded", color: "secondary" },
]

export function OrderManager() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const { t, locale } = useI18n()

  useEffect(() => {
    fetchOrders()
  }, [statusFilter])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }

      const response = await fetch(`/api/admin/orders?${params}`)
      const data = await response.json()
      setOrders(data.orders || [])
    } catch (error) {
      console.error("Failed to fetch orders:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      fetchOrders()
    } catch (error) {
      console.error("Failed to update order status:", error)
    }
  }

  const getStatusBadge = (status: string, type: "order" | "payment") => {
    const statuses = type === "order" ? ORDER_STATUSES : PAYMENT_STATUSES
    const statusConfig = statuses.find((s) => s.value === status)

    return <Badge variant={(statusConfig?.color as any) || "secondary"}>{statusConfig?.label || status}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("admin.orders")}</h1>
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("admin.filterByStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.allOrders")}</SelectItem>
              {ORDER_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.orderNumber")}</TableHead>
                <TableHead>{t("admin.customer")}</TableHead>
                <TableHead>{t("admin.status")}</TableHead>
                <TableHead>{t("admin.payment")}</TableHead>
                <TableHead>{t("common.total")}</TableHead>
                <TableHead>{t("admin.items")}</TableHead>
                <TableHead>{t("admin.date")}</TableHead>
                <TableHead className="text-right">{t("admin.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    {t("admin.noOrders")}
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono">#{order.order_number}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {order.customer.first_name} {order.customer.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">{order.customer.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={order.status} onValueChange={(value) => updateOrderStatus(order.id, value)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{getStatusBadge(order.payment_status, "payment")}</TableCell>
                    <TableCell className="font-medium">
                      {order.currency} {order.total_amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {order.items_count} {t("admin.items")}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString(locale)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        {t("admin.view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
