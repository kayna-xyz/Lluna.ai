"use client"
import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { messages as en } from "./locales/en"
import { messages as zh } from "./locales/zh"
import { messages as ko } from "./locales/ko"

export type Locale = "en" | "zh" | "ko"
const STORAGE_KEY = "lluna_locale"
const allMessages = { en, zh, ko }

type I18nContextType = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: keyof typeof en, vars?: Record<string, string>) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key as string,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en")

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (saved && allMessages[saved]) setLocaleState(saved)
  }, [])

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  const t = (key: keyof typeof en, vars?: Record<string, string>) => {
    let str = (allMessages[locale] as typeof en)[key] ?? (en[key] as string) ?? key as string
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v) })
    }
    return str
  }

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)

// Re-export dynamic translation utilities
export { useTranslated, useTranslatedObject, DynT } from "./use-translated"
export { translateText, translateBatch } from "./dynamic"
