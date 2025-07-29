import type React from "react"
import type { Metadata } from "next"
import { Inter, Cairo } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers/Providers"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { Toaster } from "@/components/ui/toaster"
import { getMessages, getLocale } from "@/lib/i18n"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    template: "%s | Advanced ECommerce Platform",
    default: "Advanced ECommerce Platform - Your Complete Online Store Solution",
  },
  description:
    "A comprehensive e-commerce platform with advanced features, multi-language support, and professional integrations",
  keywords: "ecommerce, online store, shopping, multilingual, arabic, english, dark mode",
  authors: [{ name: "ECommerce Platform Team" }],
  creator: "ECommerce Platform",
  publisher: "ECommerce Platform",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA"],
    url: "https://your-domain.com",
    siteName: "Advanced ECommerce Platform",
    title: "Advanced ECommerce Platform",
    description: "Your Complete Online Store Solution",
  },
  twitter: {
    card: "summary_large_image",
    title: "Advanced ECommerce Platform",
    description: "Your Complete Online Store Solution",
    creator: "@ecommerce_platform",
  },
    generator: 'v0.dev'
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get locale from cookies or use default
  const locale = getLocale()
  const messages = await getMessages(locale)

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${inter.variable} ${cairo.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers locale={locale} messages={messages}>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
