"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/contexts/I18nContext"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Product {
  id: string
  sku: string
  name: Record<string, string>
  price: number
  inventory_quantity: number
  is_active: boolean
  is_featured: boolean
  category: {
    name: Record<string, string>
  }
  created_at: string
}

export function ProductManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState({
    category: "",
    status: "all",
    featured: "all",
  })
  const { t, locale } = useI18n()

  useEffect(() => {
    fetchProducts()
  }, [searchQuery, filters])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        search: searchQuery,
        ...filters,
      })

      const response = await fetch(`/api/admin/products?${params}`)
      const data = await response.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error("Failed to fetch products:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm(t("admin.confirmDelete"))) return

    try {
      await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      })
      fetchProducts()
    } catch (error) {
      console.error("Failed to delete product:", error)
    }
  }

  const toggleProductStatus = async (productId: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      })
      fetchProducts()
    } catch (error) {
      console.error("Failed to update product status:", error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("admin.products")}</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t("admin.addProduct")}
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t("common.search")} & {t("common.filter")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("admin.searchProducts")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  {t("common.filter")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilters({ ...filters, status: "all" })}>
                  {t("admin.allProducts")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters({ ...filters, status: "active" })}>
                  {t("admin.activeProducts")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters({ ...filters, status: "inactive" })}>
                  {t("admin.inactiveProducts")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters({ ...filters, featured: "featured" })}>
                  {t("admin.featuredProducts")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.product")}</TableHead>
                <TableHead>{t("admin.sku")}</TableHead>
                <TableHead>{t("admin.category")}</TableHead>
                <TableHead>{t("common.price")}</TableHead>
                <TableHead>{t("admin.inventory")}</TableHead>
                <TableHead>{t("admin.status")}</TableHead>
                <TableHead className="text-right">{t("admin.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    {t("admin.noProducts")}
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name[locale] || product.name.en || "Untitled"}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.is_featured && (
                            <Badge variant="secondary" className="mr-2">
                              {t("product.featured")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell>{product.category?.name[locale] || product.category?.name.en || "-"}</TableCell>
                    <TableCell>${product.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={product.inventory_quantity > 0 ? "default" : "destructive"}>
                        {product.inventory_quantity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? "default" : "secondary"}>
                        {product.is_active ? t("admin.active") : t("admin.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            {t("admin.actions")}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleProductStatus(product.id, product.is_active)}>
                            {product.is_active ? t("admin.deactivate") : t("admin.activate")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
