"use client"

/**
 * useTranslated(text) — translates dynamic/AI-generated text reactively.
 *
 * - Returns the original text immediately (zero flicker).
 * - Async-translates in the background and swaps in the result.
 * - Re-translates when `locale` changes.
 * - No-ops when locale === "en".
 */

import { useState, useEffect, useRef, ReactNode } from "react"
import { useI18n } from "./index"
import { translateText } from "./dynamic"

export function useTranslated(text: string): string {
  const { locale } = useI18n()
  const [translated, setTranslated] = useState(text)
  const lastText = useRef(text)
  const lastLocale = useRef(locale)

  useEffect(() => {
    // Always reset to source text first so stale translation never shows
    setTranslated(text)
    lastText.current = text
    lastLocale.current = locale

    if (!text || locale === "en") return

    let cancelled = false
    translateText(text, locale).then((result) => {
      if (!cancelled && lastText.current === text && lastLocale.current === locale) {
        setTranslated(result)
      }
    })
    return () => { cancelled = true }
  }, [text, locale])

  // Sync reset when text changes before effect fires
  if (text !== lastText.current || locale !== lastLocale.current) {
    lastText.current = text
    lastLocale.current = locale
  }

  return translated
}

/**
 * <DynT> — drop-in wrapper for any dynamic/AI text node.
 *
 * Usage:
 *   <DynT>{someApiString}</DynT>
 *   <DynT as="p" className="...">{someApiString}</DynT>
 */
export function DynT({
  children,
  as: Tag = "span",
  ...rest
}: {
  children: string | null | undefined
  as?: keyof JSX.IntrinsicElements
  [key: string]: unknown
}) {
  const text = children ?? ""
  const translated = useTranslated(text)
  // @ts-expect-error dynamic tag
  return <Tag {...rest}>{translated}</Tag>
}

/**
 * useTranslatedObject — translates every string value in a plain object.
 * Useful for translating entire API response objects at once.
 *
 * Usage:
 *   const tx = useTranslatedObject({ title: rec.title, body: rec.body })
 *   // tx.title and tx.body are translated
 */
export function useTranslatedObject<T extends Record<string, string | null | undefined>>(
  obj: T
): T {
  const { locale } = useI18n()
  const [translated, setTranslated] = useState<T>(obj)

  useEffect(() => {
    setTranslated(obj) // reset immediately
    if (locale === "en") return

    const keys = Object.keys(obj) as (keyof T)[]
    const texts = keys.map((k) => obj[k] ?? "")

    Promise.all(texts.map((t) => translateText(t, locale))).then((results) => {
      const out = { ...obj } as T
      keys.forEach((k, i) => {
        out[k] = results[i] as T[keyof T]
      })
      setTranslated(out)
    })
  }, [JSON.stringify(obj), locale]) // eslint-disable-line react-hooks/exhaustive-deps

  return translated
}
