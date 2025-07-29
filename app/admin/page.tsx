import { Suspense } from "react"
import { AdminDashboard } from "@/components/admin/AdminDashboard"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

export const metadata = {
  title: "Admin Dashboard - ECommerce Platform",
  description: "Manage your store",
}

export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      <Suspense fallback={<LoadingSpinner />}>
        <AdminDashboard />
      </Suspense>
    </div>
  )
}
