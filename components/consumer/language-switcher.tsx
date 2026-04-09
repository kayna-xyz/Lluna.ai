"use client"
import { useI18n, type Locale } from "@/lib/i18n"

const OPTIONS: { locale: Locale; label: string; full: string }[] = [
  { locale: "en", label: "EN", full: "English" },
  { locale: "zh", label: "中文", full: "中文 (简体)" },
  { locale: "ko", label: "한국어", full: "한국어" },
]

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  const current = OPTIONS.find((o) => o.locale === locale) ?? OPTIONS[0]

  const open = () => {
    // iOS-style action sheet via native browser sheet on mobile
    // On iOS Safari, a <select> with size > 1 triggers the native drum-roll picker.
    // We use a hidden <select> and programmatically open it.
    const sel = document.getElementById("lluna-lang-select") as HTMLSelectElement | null
    sel?.focus()
    // Dispatch a click so iOS opens the native picker
    sel?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocale(e.target.value as Locale)
  }

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {/* Visible button — shows current language only */}
      <button
        onClick={open}
        aria-label="Change language"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 10px",
          fontSize: 13,
          fontWeight: 500,
          color: "#0A0A0A",
          background: "#F3F4F6",
          border: "none",
          borderRadius: 999,
          cursor: "pointer",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {/* Globe icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {current.label}
        {/* Chevron down */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Native <select> — invisible but triggers iOS drum-roll picker */}
      <select
        id="lluna-lang-select"
        value={locale}
        onChange={handleChange}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
          fontSize: 16, // prevents iOS zoom on focus
          border: "none",
        }}
        aria-label="Select language"
      >
        {OPTIONS.map(({ locale: l, full }) => (
          <option key={l} value={l}>
            {full}
          </option>
        ))}
      </select>
    </div>
  )
}
