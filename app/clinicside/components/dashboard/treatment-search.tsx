"use client"

import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { ClinicMenuTreatment } from "@/lib/clinic-menu"
import { firstNumericPriceForTreatment } from "@/lib/recommend-menu"

// ── TreatmentBadge ───────────────────────────────────────────────────────────

type BadgeVariant = "blue" | "orange" | "muted"

export function TreatmentBadge({
  label,
  variant = "muted",
}: {
  label: string
  variant?: BadgeVariant
}) {
  const cls =
    variant === "blue"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
      : variant === "orange"
        ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
        : "bg-muted text-muted-foreground"
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ── Price helper ─────────────────────────────────────────────────────────────

function getPriceLabel(t: ClinicMenuTreatment): string {
  if (t.pricing_model === "table" && t.pricing_table) {
    const base = firstNumericPriceForTreatment(t)
    return base > 0 ? `From $${base.toLocaleString()}` : "—"
  }
  if (t.pricing) {
    const p = t.pricing as Record<string, unknown>
    const v = p.single ?? p.perUnit ?? p.perSyringe ?? p.perSession
    if (typeof v === "number" && v > 0) return `$${v.toLocaleString()}`
  }
  const base = firstNumericPriceForTreatment(t)
  return base > 0 ? `$${base.toLocaleString()}` : "—"
}

// ── useTreatmentSearch ───────────────────────────────────────────────────────

export function useTreatmentSearch(
  treatments: ClinicMenuTreatment[],
  query: string,
): ClinicMenuTreatment[] {
  const [results, setResults] = useState<ClinicMenuTreatment[]>([])

  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      setResults([])
      return
    }
    const matched = treatments
      .filter((t) => {
        if (t.name.toLowerCase().includes(q)) return true
        if (t.tags?.some((tag) => tag.toLowerCase().includes(q))) return true
        return false
      })
      .slice(0, 8)
    setResults(matched)
  }, [treatments, query])

  return results
}

// ── TreatmentDetailCard (expanded after clicking a result) ───────────────────

function TreatmentDetailCard({
  treatment,
  onClose,
}: {
  treatment: ClinicMenuTreatment
  onClose: () => void
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{treatment.name}</p>
          {treatment.category && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{treatment.category}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-sm font-bold">{getPriceLabel(treatment)}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {treatment.description?.trim() && (
        <p className="text-xs text-muted-foreground leading-relaxed">{treatment.description}</p>
      )}

      <div className="flex flex-wrap gap-1">
        {treatment.effect_duration_months != null && (
          <TreatmentBadge
            label={`Lasts ${treatment.effect_duration_months} month${treatment.effect_duration_months === 1 ? "" : "s"}`}
            variant="blue"
          />
        )}
        {treatment.recovery_period_days != null && (
          <TreatmentBadge
            label={
              treatment.recovery_period_days === 0
                ? "No downtime"
                : `${treatment.recovery_period_days} day${treatment.recovery_period_days === 1 ? "" : "s"} recovery`
            }
            variant="orange"
          />
        )}
        {treatment.tags?.map((tag) => (
          <TreatmentBadge key={tag} label={tag} />
        ))}
      </div>
    </div>
  )
}

// ── TreatmentSearchBar ───────────────────────────────────────────────────────

interface TreatmentSearchBarProps {
  treatments: ClinicMenuTreatment[]
}

export function TreatmentSearchBar({ treatments }: TreatmentSearchBarProps) {
  const [rawQuery, setRawQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState<ClinicMenuTreatment | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 300 ms debounce
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(rawQuery), 300)
    return () => clearTimeout(id)
  }, [rawQuery])

  const results = useTreatmentSearch(treatments, debouncedQuery)

  // Sync dropdown visibility with results
  useEffect(() => {
    setIsOpen(rawQuery.trim().length > 0)
  }, [rawQuery])

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [])

  function handleSelect(t: ClinicMenuTreatment) {
    setSelected(t)
    setIsOpen(false)
    setRawQuery("")
    setDebouncedQuery("")
  }

  function handleClear() {
    setRawQuery("")
    setDebouncedQuery("")
    setIsOpen(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && results.length > 0) {
      handleSelect(results[0])
    }
    if (e.key === "Escape") {
      setIsOpen(false)
      setRawQuery("")
    }
  }

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Input row */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => rawQuery.trim() && setIsOpen(true)}
          placeholder="Search treatments…"
          className="h-8 pl-8 pr-7 text-xs"
        />
        {rawQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {/* Floating dropdown */}
        {isOpen && (
          <div className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
            {results.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">No treatments found</p>
            ) : (
              <ul>
                {results.map((t) => (
                  <li
                    key={t.id}
                    onClick={() => handleSelect(t)}
                    className="flex cursor-pointer items-start gap-3 border-b border-border/40 px-3 py-2.5 last:border-0 hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">{t.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.effect_duration_months != null && (
                          <TreatmentBadge
                            label={`Lasts ${t.effect_duration_months}mo`}
                            variant="blue"
                          />
                        )}
                        {t.recovery_period_days != null && (
                          <TreatmentBadge
                            label={
                              t.recovery_period_days === 0
                                ? "No downtime"
                                : `${t.recovery_period_days}d recovery`
                            }
                            variant="orange"
                          />
                        )}
                        {t.tags?.slice(0, 2).map((tag) => (
                          <TreatmentBadge key={tag} label={tag} />
                        ))}
                      </div>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-foreground">
                      {getPriceLabel(t)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Expanded detail card — shown after selecting a result */}
      {selected && (
        <TreatmentDetailCard treatment={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
