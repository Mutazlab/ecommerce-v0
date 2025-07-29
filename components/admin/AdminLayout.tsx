"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Package, ShoppingCart, Users, BarChart3, Settings, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/contexts/I18nContext"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "products", href: "/admin/products", icon: Package },
  { name: "orders", href: "/admin/orders", icon: ShoppingCart },
  { name: "customers", href: "/admin/customers", icon: Users },
  { name: "analytics", href: "/admin/analytics", icon: BarChart3 },
  { name: "settings", href: "/admin/settings", icon: Settings },
]

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b">
          <h1 className="text-xl font-bold">{t("admin.dashboard")}</h1>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="mt-8">
          <div className="px-4 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {t(`admin.${item.name}`)}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-card border-b px-4 py-4 lg:px-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">{t("common.hello")}, Admin</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
