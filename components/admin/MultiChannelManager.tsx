"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/contexts/I18nContext"
import { useToast } from "@/hooks/use-toast"
import {
  Facebook,
  Instagram,
  ShoppingBag,
  Store,
  Smartphone,
  Settings,
  FolderSyncIcon as Sync,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react"

interface ChannelIntegration {
  id: string
  channel: string
  name: string
  isActive: boolean
  lastSync: string | null
  syncStatus: "pending" | "syncing" | "success" | "error"
  productsCount: number
  ordersCount: number
}

export function MultiChannelManager() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [integrations, setIntegrations] = useState<ChannelIntegration[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchIntegrations()
  }, [])

  const fetchIntegrations = async () => {
    try {
      const response = await fetch("/api/admin/integrations")
      if (response.ok) {
        const data = await response.json()
        setIntegrations(data)
      }
    } catch (error) {
      console.error("Failed to fetch integrations:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleIntegration = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/integrations/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive }),
      })

      if (response.ok) {
        setIntegrations((prev) =>
          prev.map((integration) => (integration.id === id ? { ...integration, isActive } : integration)),
        )
        toast({
          title: t("common.success"),
          description: `Integration ${isActive ? "enabled" : "disabled"} successfully`,
        })
      }
    } catch (error) {
      toast({
        title: t("common.error"),
        description: "Failed to update integration",
        variant: "destructive",
      })
    }
  }

  const syncChannel = async (id: string) => {
    try {
      setIntegrations((prev) =>
        prev.map((integration) => (integration.id === id ? { ...integration, syncStatus: "syncing" } : integration)),
      )

      const response = await fetch(`/api/admin/integrations/${id}/sync`, {
        method: "POST",
      })

      if (response.ok) {
        setIntegrations((prev) =>
          prev.map((integration) =>
            integration.id === id
              ? {
                  ...integration,
                  syncStatus: "success",
                  lastSync: new Date().toISOString(),
                }
              : integration,
          ),
        )
        toast({
          title: t("common.success"),
          description: "Channel synced successfully",
        })
      } else {
        setIntegrations((prev) =>
          prev.map((integration) => (integration.id === id ? { ...integration, syncStatus: "error" } : integration)),
        )
        throw new Error("Sync failed")
      }
    } catch (error) {
      toast({
        title: t("common.error"),
        description: "Failed to sync channel",
        variant: "destructive",
      })
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "facebook":
        return <Facebook className="h-5 w-5" />
      case "instagram":
        return <Instagram className="h-5 w-5" />
      case "amazon":
        return <ShoppingBag className="h-5 w-5" />
      case "ebay":
        return <Store className="h-5 w-5" />
      case "pos":
        return <Smartphone className="h-5 w-5" />
      default:
        return <Settings className="h-5 w-5" />
    }
  }

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "syncing":
        return <Sync className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getSyncStatusText = (status: string) => {
    switch (status) {
      case "success":
        return "Synced"
      case "error":
        return "Error"
      case "syncing":
        return "Syncing..."
      default:
        return "Pending"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("admin.multiChannel")}</h2>
          <p className="text-muted-foreground">Manage your sales channels and integrations</p>
        </div>
        <Button onClick={fetchIntegrations}>
          <Sync className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="social">Social Media</TabsTrigger>
          <TabsTrigger value="marketplaces">Marketplaces</TabsTrigger>
          <TabsTrigger value="pos">Point of Sale</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => (
              <Card key={integration.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center space-x-2">
                    {getChannelIcon(integration.channel)}
                    <CardTitle className="text-sm font-medium">{integration.name}</CardTitle>
                  </div>
                  <Switch
                    checked={integration.isActive}
                    onCheckedChange={(checked) => toggleIntegration(integration.id, checked)}
                  />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Status:</span>
                      <div className="flex items-center space-x-1">
                        {getSyncStatusIcon(integration.syncStatus)}
                        <span>{getSyncStatusText(integration.syncStatus)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Products:</span>
                      <Badge variant="secondary">{integration.productsCount}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Orders:</span>
                      <Badge variant="secondary">{integration.ordersCount}</Badge>
                    </div>
                    {integration.lastSync && (
                      <div className="text-xs text-muted-foreground">
                        Last sync: {new Date(integration.lastSync).toLocaleString()}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2 bg-transparent"
                      onClick={() => syncChannel(integration.id)}
                      disabled={integration.syncStatus === "syncing" || !integration.isActive}
                    >
                      <Sync className="h-3 w-3 mr-1" />
                      Sync Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Facebook className="h-5 w-5" />
                  <span>Facebook Shop</span>
                </CardTitle>
                <CardDescription>Sell directly on Facebook with product catalog sync</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-sync products</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sync inventory</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Import orders</span>
                    <Switch defaultChecked />
                  </div>
                  <Button className="w-full">Configure Facebook Shop</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Instagram className="h-5 w-5" />
                  <span>Instagram Shopping</span>
                </CardTitle>
                <CardDescription>Tag products in posts and stories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Product tagging</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Story shopping</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Shopping ads</span>
                    <Switch />
                  </div>
                  <Button className="w-full">Configure Instagram Shopping</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="marketplaces" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ShoppingBag className="h-5 w-5" />
                  <span>Amazon Marketplace</span>
                </CardTitle>
                <CardDescription>Sell on Amazon with automated inventory sync</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">FBA integration</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Price sync</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Order import</span>
                    <Switch defaultChecked />
                  </div>
                  <Button className="w-full">Configure Amazon</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Store className="h-5 w-5" />
                  <span>eBay Store</span>
                </CardTitle>
                <CardDescription>List products on eBay marketplace</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-listing</span>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Best offer</span>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auction format</span>
                    <Switch />
                  </div>
                  <Button className="w-full">Configure eBay</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pos" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Smartphone className="h-5 w-5" />
                  <span>Square POS</span>
                </CardTitle>
                <CardDescription>Sync with Square point of sale system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Inventory sync</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Customer sync</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sales reporting</span>
                    <Switch defaultChecked />
                  </div>
                  <Button className="w-full">Configure Square</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Store className="h-5 w-5" />
                  <span>Clover POS</span>
                </CardTitle>
                <CardDescription>Connect with Clover point of sale</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Real-time sync</span>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Payment processing</span>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Loyalty integration</span>
                    <Switch />
                  </div>
                  <Button className="w-full">Configure Clover</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
