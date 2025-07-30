"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useI18n } from "@/contexts/I18nContext"
import { useToast } from "@/hooks/use-toast"
import {
  Facebook,
  Instagram,
  ShoppingBag,
  Store,
  FolderSyncIcon as Sync,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
} from "lucide-react"

interface Channel {
  id: string
  name: string
  type: "social" | "marketplace" | "pos"
  platform: string
  isActive: boolean
  isConnected: boolean
  lastSync: string | null
  syncStatus: "idle" | "syncing" | "success" | "error"
  productCount: number
  orderCount: number
  revenue: number
}

interface SyncStatus {
  productId: string
  productName: string
  channels: Record<
    string,
    {
      status: "synced" | "failed" | "pending"
      lastSync: string | null
      error?: string
    }
  >
}

export function MultiChannelManager() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const { t } = useI18n()
  const { toast } = useToast()

  useEffect(() => {
    fetchChannels()
    fetchSyncStatuses()
  }, [])

  const fetchChannels = async () => {
    try {
      const response = await fetch("/api/admin/channels")
      const data = await response.json()
      setChannels(data.channels || [])
    } catch (error) {
      console.error("Failed to fetch channels:", error)
      toast({
        title: "Error",
        description: "Failed to load channels",
        variant: "destructive",
      })
    }
  }

  const fetchSyncStatuses = async () => {
    try {
      const response = await fetch("/api/admin/channels/sync-status")
      const data = await response.json()
      setSyncStatuses(data.syncStatuses || [])
    } catch (error) {
      console.error("Failed to fetch sync statuses:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleChannel = async (channelId: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/channels/${channelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })

      setChannels((prev) => prev.map((channel) => (channel.id === channelId ? { ...channel, isActive } : channel)))

      toast({
        title: "Success",
        description: `Channel ${isActive ? "activated" : "deactivated"} successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update channel status",
        variant: "destructive",
      })
    }
  }

  const syncChannel = async (channelId: string) => {
    try {
      setChannels((prev) =>
        prev.map((channel) => (channel.id === channelId ? { ...channel, syncStatus: "syncing" } : channel)),
      )

      const response = await fetch(`/api/admin/channels/${channelId}/sync`, {
        method: "POST",
      })

      if (response.ok) {
        setChannels((prev) =>
          prev.map((channel) =>
            channel.id === channelId
              ? {
                  ...channel,
                  syncStatus: "success",
                  lastSync: new Date().toISOString(),
                }
              : channel,
          ),
        )

        toast({
          title: "Success",
          description: "Channel synced successfully",
        })
      } else {
        throw new Error("Sync failed")
      }
    } catch (error) {
      setChannels((prev) =>
        prev.map((channel) => (channel.id === channelId ? { ...channel, syncStatus: "error" } : channel)),
      )

      toast({
        title: "Error",
        description: "Failed to sync channel",
        variant: "destructive",
      })
    }
  }

  const syncAllChannels = async () => {
    try {
      const activeChannels = channels.filter((c) => c.isActive && c.isConnected)

      for (const channel of activeChannels) {
        await syncChannel(channel.id)
      }

      toast({
        title: "Success",
        description: "All channels synced successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sync all channels",
        variant: "destructive",
      })
    }
  }

  const getChannelIcon = (platform: string) => {
    switch (platform) {
      case "facebook":
        return <Facebook className="h-5 w-5 text-blue-600" />
      case "instagram":
        return <Instagram className="h-5 w-5 text-pink-600" />
      case "amazon":
        return <ShoppingBag className="h-5 w-5 text-orange-600" />
      case "ebay":
        return <ShoppingBag className="h-5 w-5 text-yellow-600" />
      case "square":
      case "clover":
        return <Store className="h-5 w-5 text-green-600" />
      default:
        return <Store className="h-5 w-5 text-gray-600" />
    }
  }

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case "syncing":
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const totalRevenue = channels.reduce((sum, channel) => sum + channel.revenue, 0)
  const totalOrders = channels.reduce((sum, channel) => sum + channel.orderCount, 0)
  const activeChannels = channels.filter((c) => c.isActive && c.isConnected).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading channels...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Multi-Channel Management</h1>
        <div className="flex gap-2">
          <Button onClick={syncAllChannels} disabled={activeChannels === 0}>
            <Sync className="h-4 w-4 mr-2" />
            Sync All Channels
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Channels</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeChannels}</div>
            <p className="text-xs text-muted-foreground">of {channels.length} total channels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">across all channels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">from all channels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
            <Sync className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{channels.filter((c) => c.syncStatus === "success").length}</div>
            <p className="text-xs text-muted-foreground">channels synced successfully</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="social">Social Media</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplaces</TabsTrigger>
          <TabsTrigger value="pos">Point of Sale</TabsTrigger>
          <TabsTrigger value="sync-status">Sync Status</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>All Channels</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels.map((channel) => (
                    <TableRow key={channel.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {getChannelIcon(channel.platform)}
                          <div>
                            <div className="font-medium">{channel.name}</div>
                            <div className="text-sm text-muted-foreground capitalize">
                              {channel.type} • {channel.platform}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={channel.isConnected ? "default" : "secondary"}>
                            {channel.isConnected ? "Connected" : "Disconnected"}
                          </Badge>
                          <Switch
                            checked={channel.isActive}
                            onCheckedChange={(checked) => toggleChannel(channel.id, checked)}
                            disabled={!channel.isConnected}
                          />
                        </div>
                      </TableCell>
                      <TableCell>{channel.productCount.toLocaleString()}</TableCell>
                      <TableCell>{channel.orderCount.toLocaleString()}</TableCell>
                      <TableCell>${channel.revenue.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSyncStatusIcon(channel.syncStatus)}
                          <span className="text-sm">
                            {channel.lastSync ? new Date(channel.lastSync).toLocaleDateString() : "Never"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncChannel(channel.id)}
                          disabled={!channel.isActive || !channel.isConnected || channel.syncStatus === "syncing"}
                        >
                          <Sync className="h-4 w-4 mr-1" />
                          Sync
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {channels
              .filter((c) => c.type === "social")
              .map((channel) => (
                <Card key={channel.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getChannelIcon(channel.platform)}
                        <CardTitle>{channel.name}</CardTitle>
                      </div>
                      <Switch
                        checked={channel.isActive}
                        onCheckedChange={(checked) => toggleChannel(channel.id, checked)}
                        disabled={!channel.isConnected}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={channel.isConnected ? "default" : "secondary"}>
                          {channel.isConnected ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Products:</span>
                        <span>{channel.productCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Orders:</span>
                        <span>{channel.orderCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Revenue:</span>
                        <span>${channel.revenue.toLocaleString()}</span>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => syncChannel(channel.id)}
                        disabled={!channel.isActive || !channel.isConnected || channel.syncStatus === "syncing"}
                      >
                        <Sync className="h-4 w-4 mr-2" />
                        {channel.syncStatus === "syncing" ? "Syncing..." : "Sync Now"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="marketplace">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {channels
              .filter((c) => c.type === "marketplace")
              .map((channel) => (
                <Card key={channel.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getChannelIcon(channel.platform)}
                        <CardTitle>{channel.name}</CardTitle>
                      </div>
                      <Switch
                        checked={channel.isActive}
                        onCheckedChange={(checked) => toggleChannel(channel.id, checked)}
                        disabled={!channel.isConnected}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={channel.isConnected ? "default" : "secondary"}>
                          {channel.isConnected ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Products:</span>
                        <span>{channel.productCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Orders:</span>
                        <span>{channel.orderCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Revenue:</span>
                        <span>${channel.revenue.toLocaleString()}</span>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => syncChannel(channel.id)}
                        disabled={!channel.isActive || !channel.isConnected || channel.syncStatus === "syncing"}
                      >
                        <Sync className="h-4 w-4 mr-2" />
                        {channel.syncStatus === "syncing" ? "Syncing..." : "Sync Now"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="pos">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {channels
              .filter((c) => c.type === "pos")
              .map((channel) => (
                <Card key={channel.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getChannelIcon(channel.platform)}
                        <CardTitle>{channel.name}</CardTitle>
                      </div>
                      <Switch
                        checked={channel.isActive}
                        onCheckedChange={(checked) => toggleChannel(channel.id, checked)}
                        disabled={!channel.isConnected}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={channel.isConnected ? "default" : "secondary"}>
                          {channel.isConnected ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Products:</span>
                        <span>{channel.productCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Orders:</span>
                        <span>{channel.orderCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Revenue:</span>
                        <span>${channel.revenue.toLocaleString()}</span>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => syncChannel(channel.id)}
                        disabled={!channel.isActive || !channel.isConnected || channel.syncStatus === "syncing"}
                      >
                        <Sync className="h-4 w-4 mr-2" />
                        {channel.syncStatus === "syncing" ? "Syncing..." : "Sync Now"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="sync-status">
          <Card>
            <CardHeader>
              <CardTitle>Product Sync Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    {channels
                      .filter((c) => c.isActive)
                      .map((channel) => (
                        <TableHead key={channel.id}>{channel.name}</TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncStatuses.map((status) => (
                    <TableRow key={status.productId}>
                      <TableCell className="font-medium">{status.productName}</TableCell>
                      {channels
                        .filter((c) => c.isActive)
                        .map((channel) => {
                          const channelStatus = status.channels[channel.id]
                          return (
                            <TableCell key={channel.id}>
                              <div className="flex items-center gap-2">
                                {channelStatus ? (
                                  <>
                                    <Badge
                                      variant={
                                        channelStatus.status === "synced"
                                          ? "default"
                                          : channelStatus.status === "failed"
                                            ? "destructive"
                                            : "secondary"
                                      }
                                    >
                                      {channelStatus.status}
                                    </Badge>
                                    {channelStatus.lastSync && (
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(channelStatus.lastSync).toLocaleDateString()}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <Badge variant="secondary">Not synced</Badge>
                                )}
                              </div>
                            </TableCell>
                          )
                        })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
