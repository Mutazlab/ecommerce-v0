"use client"

import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useI18n } from "@/contexts/I18nContext"
import { useRouter, usePathname } from "next/navigation"

const languages = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
]

export function LanguageSwitcher() {
  const { locale, t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()

  const switchLanguage = (newLocale: string) => {
    // Remove current locale from pathname if it exists
    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, "") || "/"
    const newPath = newLocale === "en" ? pathWithoutLocale : `/${newLocale}${pathWithoutLocale}`

    // Store language preference
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000`

    router.push(newPath)
  }

  const currentLanguage = languages.find((lang) => lang.code === locale)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Globe className="h-4 w-4" />
          <span className="sr-only">{t("common.changeLanguage")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => switchLanguage(language.code)}
            className={`flex items-center justify-between ${locale === language.code ? "bg-accent" : ""}`}
          >
            <span>{language.nativeName}</span>
            {locale === language.code && <div className="h-2 w-2 rounded-full bg-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
