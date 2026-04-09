/**
 * Dynamic translation cache + batch fetch.
 * Caches in memory (session) and localStorage (persistent).
 * Batches concurrent requests to minimise API calls.
 */

type Locale = "en" | "zh" | "ko"

// ─── In-memory cache ─────────────────────────────────────────────────────────
const memCache = new Map<string, string>()

function cacheKey(text: string, locale: Locale) {
  return `${locale}:${text}`
}

function fromCache(text: string, locale: Locale): string | null {
  const k = cacheKey(text, locale)
  if (memCache.has(k)) return memCache.get(k)!

  // Try localStorage
  try {
    const v = localStorage.getItem(`lluna_tx:${k}`)
    if (v) {
      memCache.set(k, v)
      return v
    }
  } catch {}
  return null
}

function toCache(text: string, locale: Locale, translated: string) {
  const k = cacheKey(text, locale)
  memCache.set(k, translated)
  try {
    // Limit localStorage size — evict oldest if over 500 entries
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("lluna_tx:"))
    if (keys.length > 500) localStorage.removeItem(keys[0])
    localStorage.setItem(`lluna_tx:${k}`, translated)
  } catch {}
}

// ─── Batch queue ─────────────────────────────────────────────────────────────
// Collects texts that arrive within the same tick, then sends one API call.
type PendingItem = {
  text: string
  resolve: (v: string) => void
}

const pendingByLocale = new Map<Locale, PendingItem[]>()
const timerByLocale = new Map<Locale, ReturnType<typeof setTimeout>>()

function flush(locale: Locale) {
  const items = pendingByLocale.get(locale) ?? []
  pendingByLocale.set(locale, [])
  timerByLocale.delete(locale)
  if (!items.length) return

  const texts = items.map((i) => i.text)

  fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, targetLang: locale }),
  })
    .then((r) => r.json())
    .then((data: { translations?: string[] }) => {
      const translations = data.translations ?? texts
      items.forEach((item, idx) => {
        const translated = translations[idx] ?? item.text
        toCache(item.text, locale, translated)
        item.resolve(translated)
      })
    })
    .catch(() => {
      // On error return originals
      items.forEach((item) => item.resolve(item.text))
    })
}

/**
 * Translate a single string to the target locale.
 * Returns a Promise that resolves immediately from cache, or after the next
 * batched API call.
 */
export function translateText(text: string, locale: Locale): Promise<string> {
  if (!text?.trim() || locale === "en") return Promise.resolve(text)

  const cached = fromCache(text, locale)
  if (cached !== null) return Promise.resolve(cached)

  return new Promise<string>((resolve) => {
    const list = pendingByLocale.get(locale) ?? []
    list.push({ text, resolve })
    pendingByLocale.set(locale, list)

    // Debounce: collect for one tick, then flush
    if (!timerByLocale.has(locale)) {
      timerByLocale.set(
        locale,
        setTimeout(() => flush(locale), 0)
      )
    }
  })
}

/**
 * Translate an array of strings in one batch call.
 */
export async function translateBatch(
  texts: string[],
  locale: Locale
): Promise<string[]> {
  if (locale === "en") return texts
  return Promise.all(texts.map((t) => translateText(t, locale)))
}
