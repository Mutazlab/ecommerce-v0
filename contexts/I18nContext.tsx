"use client"

import { createContext, useContext, type ReactNode } from "react"

interface I18nContextType {
  locale: string
  messages: Record<string, any>
  t: (key: string, params?: Record<string, any>) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

interface I18nProviderProps {
  children: ReactNode
  locale: string
  messages: Record<string, any>
}

export function I18nProvider({ children, locale, messages }: I18nProviderProps) {
  const t = (key: string, params?: Record<string, any>): string => {
    const keys = key.split(".")
    let value = messages

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k]
      } else {
        return key // Return key if translation not found
      }
    }

    if (typeof value !== "string") {
      return key
    }

    // Simple parameter replacement
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey]?.toString() || match
      })
    }

    return value
  }

  return <I18nContext.Provider value={{ locale, messages, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}
