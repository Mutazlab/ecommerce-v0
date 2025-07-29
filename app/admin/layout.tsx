import type React from "react"
import { AdminLayout } from "@/components/admin/AdminLayout"

export const metadata = {
  title: "Admin Dashboard - ECommerce Platform",
  description: "Manage your store with our comprehensive admin panel",
}

interface AdminRootLayoutProps {
  children: React.ReactNode
}

export default function AdminRootLayout({ children }: AdminRootLayoutProps) {
  return <AdminLayout>{children}</AdminLayout>
}
