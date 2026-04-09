"use client"
import { useI18n, type Locale } from "@/lib/i18n"

const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "en", label: "EN" },
  { locale: "zh", label: "中" },
  { locale: "ko", label: "한" },
]

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()

  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        background: "#F3F4F6",
        borderRadius: 999,
        padding: 3,
        flexShrink: 0,
      }}
    >
      {OPTIONS.map(({ locale: l, label }) => {
        const active = locale === l
        return (
          <button
            key={l}
            onClick={() => setLocale(l)}
            style={{
              padding: "4px 10px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              borderRadius: 999,
              border: "none",
              background: active ? "#0A0A0A" : "transparent",
              color: active ? "#FFFFFF" : "#6B7280",
              transition: "background 0.15s ease, color 0.15s ease",
              lineHeight: 1,
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
