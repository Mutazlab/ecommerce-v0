"use client"

import type React from "react"

import { ThemeProvider } from "next-themes"
import { CartProvider } from "@/contexts/CartContext"
import { AuthProvider } from "@/contexts/AuthContext"
import { I18nProvider } from "@/contexts/I18nContext"
import { SearchProvider } from "@/contexts/SearchContext"
import { RecommendationProvider } from "@/contexts/RecommendationContext"

interface ProvidersProps {
  children: React.ReactNode
  locale: string
  messages: any
}

export function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider locale={locale} messages={messages}>
        <AuthProvider>
          <CartProvider>
            <SearchProvider>
              <RecommendationProvider>{children}</RecommendationProvider>
            </SearchProvider>
          </CartProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
