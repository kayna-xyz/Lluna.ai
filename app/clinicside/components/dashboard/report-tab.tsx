"use client"

import { useEffect, useState } from "react"
import type { ChangeEvent } from "react"
import { DollarSign, Target, X, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ClientNotification } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { clinicFetch } from "@/app/clinicside/lib/clinic-api"
import { ReferralPerformanceCard } from "./referral-performance-card"
import type { Client } from "../../lib/data"
import { MENU_BY_ID } from "../../../../lib/clinic-menu"
import type { ClinicMenuTreatment } from "../../../../lib/clinic-menu"
import { RECOVERY_RULES, inferTags, inferFixedMetadata } from "../../../../lib/treatment-price-resolver"
import { firstNumericPriceForTreatment } from "../../../../lib/recommend-menu"
import { TreatmentSearchBar } from "./treatment-search"

interface ClientReportPanelProps {
  selectedClientReport?: ClientNotification | null
  onCloseClientReport?: () => void
  onRefreshClients?: () => void
}

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
}

/**
 * Resolve display cost from menu data. Uses the same deterministic rules as the server.
 * Falls back to stored cost if no menu entry found (e.g. custom clinic menu).
 * Returns null only if both menu and stored cost are absent.
 */
function resolveDisplayCost(t: Record<string, unknown>): number | null {
  const treatmentId = String(t.treatmentId || "")
  const storedCost = Number(t.cost) || null
  const menuEntry = MENU_BY_ID.get(treatmentId)
  if (!menuEntry) return storedCost

  const p = menuEntry.pricing as Record<string, unknown> | undefined
  const units = Number(t.units) || 0
  const syringes = Number(t.syringes) || 0

  if (p && typeof p.perUnit === "number" && p.perUnit > 0 && units > 0) return p.perUnit * units
  if (p && typeof p.perSyringe === "number" && p.perSyringe > 0 && syringes > 0) return p.perSyringe * syringes
  if (p && typeof p.single === "number" && p.single > 0) return p.single

  const base = firstNumericPriceForTreatment(menuEntry)
  if (base > 0) return base
  return storedCost
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount)
}

const LEGACY_TREATMENT_NAME_BY_ID: Record<string, string> = {
  t001: "Toxin —— Botox",
  t002: "Filler —— Juvederm Ultra XC/Restylane",
  t003: "Morpheus8 by InMode",
  t004: "MiniFX by InMode",
  t005: "Hydrafacial Syndeo",
  t006: "VI Peel + Precision Plus",
  t007: "Thermage FLX",
}


/**
 * Normalize recovery (downtime) with 3-tier fallback:
 * 1. Deterministic rule by treatment name
 * 2. Stored numeric-range value from AI (if valid)
 * 3. Default "3–7 days"
 * Never allows "None", "Minimal", or free text.
 */
function normalizeRecoveryTag(downtime: string, treatmentName: string): string {
  // Tier 1: deterministic rules
  for (const [pattern, value] of RECOVERY_RULES) {
    if (pattern.test(treatmentName)) return value
  }
  // Tier 2: accept stored value only if it's a valid numeric range
  const s = downtime.trim()
  if (s) {
    const normalized = s.replace(/\s+to\s+/gi, "–").replace(/\s*[-—]\s*/g, "–")
    if (/\d/.test(normalized) && !/^(none|minimal|permanent|no downtime)/i.test(normalized)) {
      return normalized
    }
  }
  // Tier 3: default
  return "3–7 days"
}

/** Format recovery_period_days as a display string. */
function formatRecoveryDays(days: number): string {
  if (days === 0) return 'No downtime'
  return `${days} day${days === 1 ? '' : 's'}`
}

/** Format effect_duration_months as a display string. */
function formatEffectMonths(months: number): string {
  if (months < 1) return '< 1 month'
  return `${months} month${months === 1 ? '' : 's'}`
}

/**
 * Resolve display metadata for a treatment object.
 *
 * Numeric fields (recovery_period_days, effect_duration_months) take priority.
 * Source chain:
 *   1. Stored numeric fields on the object (from enriched menu)
 *   2. Fixed rules via inferFixedMetadata (deterministic, by name)
 *   3. String fallback — parse legacy AI recommendation fields (downtime string)
 */
function getTreatmentTags(t: Record<string, unknown>): { description: string; effectDuration: string; downtime: string; tags: string[] } {
  const treatmentName = String(t.treatmentName || t.name || "")

  // Numeric fields — present when this treatment came from an enriched menu row
  const storedDays = typeof t.recovery_period_days === 'number' ? t.recovery_period_days : null
  const storedMonths = typeof t.effect_duration_months === 'number' ? t.effect_duration_months : null

  // Fixed rules as secondary source (always deterministic)
  const fixed = inferFixedMetadata(treatmentName)

  const recoveryDays = storedDays ?? fixed?.recovery_period_days ?? null
  const effectMonths = storedMonths ?? fixed?.effect_duration_months ?? null

  // Format numeric values, or fall back to legacy string parsing
  let downtimeStr: string
  if (recoveryDays !== null) {
    downtimeStr = formatRecoveryDays(recoveryDays)
  } else {
    let downtimeFallback = String(t.downtime || "").trim()
    if (!downtimeFallback) {
      const raw = String(t.reason || "").trim()
      const [, line2 = ""] = raw.split("\n")
      downtimeFallback = line2.match(/Downtime:\s*([^|]+)/i)?.[1]?.trim() || ""
    }
    downtimeStr = normalizeRecoveryTag(downtimeFallback, treatmentName)
  }

  const effectDuration = effectMonths !== null ? formatEffectMonths(effectMonths) : ''

  // Description: prefer stored, fall back to first line of reason
  let description = String(t.description || "").trim()
  if (!description) {
    const raw = String(t.reason || "").trim()
    description = raw.split("\n")[0]?.trim() || ""
  }

  // Tags: stored → inferred
  const storedTags = Array.isArray(t.tags) ? (t.tags as string[]) : null
  const tags = storedTags ?? inferTags(treatmentName)

  return { description, effectDuration, downtime: downtimeStr, tags }
}

function treatmentLabelFromUnknown(t: Record<string, unknown>) {
  const rawName = String(t.treatmentName || "").trim()
  if (rawName) return rawName
  const rawId = String(t.treatmentId || "").trim()
  if (!rawId) return "—"
  return (
    MENU_BY_ID.get(rawId)?.name ||
    LEGACY_TREATMENT_NAME_BY_ID[rawId] ||
    rawId
  )
}

type BriefTier = "Premium" | "Mid" | "Budget"
type BriefBlock = {
  score: number
  tier: BriefTier
  reason: string
}

function clampScore(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 3
  return Math.max(1, Math.min(5, Math.round(n)))
}

function normTier(v: unknown): BriefTier {
  const s = String(v || "").toLowerCase()
  if (s === "premium") return "Premium"
  if (s === "budget") return "Budget"
  return "Mid"
}

function parseLegacyBriefText(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const parseLine = (line: string, fallbackTier: BriefTier): BriefBlock => {
    const scoreMatch = line.match(/(\d)\s*\/\s*5/i)
    const tierMatch = line.match(/tier\s*:\s*(premium|mid|budget)/i)
    const reason = line.split("-").slice(1).join("-").trim() || line
    return {
      score: clampScore(scoreMatch?.[1]),
      tier: normTier(tierMatch?.[1] || fallbackTier),
      reason: reason || "No additional note.",
    }
  }
  return {
    consumptionCapability: parseLine(lines[0] || "", "Mid"),
    longTermPossibility: {
      ...parseLine(lines[1] || "", "Mid"),
      isReturning: /returning/i.test(lines[1] || "") ? "returning" : /new/i.test(lines[1] || "") ? "new" : "unknown",
    },
    referralAbility: {
      ...parseLine(lines[2] || "", "Mid"),
      isLocal: /local:\s*yes/i.test(lines[2] || "") ? "yes" : /local:\s*no/i.test(lines[2] || "") ? "no" : "unknown",
    },
  }
}

// Comprehensive mock client report data
const mockClientReports: Record<string, {
  // Basic Info
  age: number
  occupation: string
  location: string
  // Visit Info
  visitCount: number
  isNewCustomer: boolean
  memberSince: string
  // Financial
  budget: string
  budgetAmount: number
  actualSpend: number
  // Concerns & Preferences
  faceProblem: string[]
  therapyPreference: string[]
  skinType: string
  allergies: string[]
  // Referrals
  referredBy: string | null
  referralsMade: number
  referralValue: number
  // Goals
  goals: string[]
  // AI-generated sales points
  salesTalkingPoints: string[]
}> = {
  "Emily Zhang": {
    age: 38,
    occupation: "Marketing Director",
    location: "San Francisco, CA",
    visitCount: 12,
    isNewCustomer: false,
    memberSince: "Jan 2025",
    budget: "$800 - $1,200",
    budgetAmount: 1000,
    actualSpend: 1450,
    faceProblem: ["Fine lines around eyes", "Uneven skin tone", "Loss of volume in cheeks"],
    therapyPreference: ["Non-invasive", "Natural results", "Minimal downtime"],
    skinType: "Combination, sensitive",
    allergies: ["Latex"],
    referredBy: "Jennifer Liu",
    referralsMade: 3,
    referralValue: 4200,
    goals: ["Look refreshed for upcoming wedding", "Natural results", "Long-term skin health"],
    salesTalkingPoints: [
      "Wedding in 6 weeks - create urgency for treatment timeline",
      "Emphasize 'natural results' - show subtle before/after photos",
      "Budget flexibility - suggest premium combo package",
      "Loyal customer with 12 visits - offer VIP upgrade"
    ]
  },
  "Jennifer Liu": {
    age: 45,
    occupation: "Real Estate Developer",
    location: "Palo Alto, CA",
    visitCount: 28,
    isNewCustomer: false,
    memberSince: "Mar 2024",
    budget: "$2,000 - $3,500",
    budgetAmount: 2500,
    actualSpend: 3200,
    faceProblem: ["Deep nasolabial folds", "Lip volume loss", "Skin texture"],
    therapyPreference: ["Premium products only", "Private room", "Same consultant"],
    skinType: "Normal, mature",
    allergies: [],
    referredBy: null,
    referralsMade: 8,
    referralValue: 12000,
    goals: ["Maintain youthful appearance", "Body contouring consultation"],
    salesTalkingPoints: [
      "VIP Ambassador - 8 referrals worth $12K",
      "Due for filler touch-up - suggest maintenance package",
      "Mentioned interest in Coolsculpting - book consultation",
      "Anniversary coming up - partner gift opportunity"
    ]
  },
  "Sarah Chen": {
    age: 26,
    occupation: "Software Engineer",
    location: "Mountain View, CA",
    visitCount: 4,
    isNewCustomer: false,
    memberSince: "Dec 2025",
    budget: "$300 - $500",
    budgetAmount: 400,
    actualSpend: 480,
    faceProblem: ["Acne scarring", "Large pores", "Hyperpigmentation"],
    therapyPreference: ["Evidence-based treatments", "Tech-forward approaches"],
    skinType: "Oily, acne-prone",
    allergies: ["Salicylic acid"],
    referredBy: "Jennifer Liu",
    referralsMade: 1,
    referralValue: 650,
    goals: ["Clear skin for summer events", "Reduce visible scarring"],
    salesTalkingPoints: [
      "Jennifer Liu referral - build on that trust",
      "Summer timeline - start treatment series now",
      "Budget-conscious - offer payment plan for series",
      "Avoid salicylic acid - recommend alternatives"
    ]
  },
  "Michael Wong": {
    age: 30,
    occupation: "Product Manager",
    location: "San Jose, CA",
    visitCount: 1,
    isNewCustomer: true,
    memberSince: "Mar 2026",
    budget: "$500 - $800",
    budgetAmount: 650,
    actualSpend: 580,
    faceProblem: ["Forehead lines", "Crow's feet", "Early aging signs"],
    therapyPreference: ["Quick treatments", "No downtime", "Discrete"],
    skinType: "Normal",
    allergies: [],
    referredBy: "Robert Chen",
    referralsMade: 0,
    referralValue: 0,
    goals: ["Preventative anti-aging", "Maintain current look"],
    salesTalkingPoints: [
      "First visit - focus on building trust",
      "Preventative angle - investment in future",
      "Busy schedule - emphasize lunch-break treatments",
      "Tech industry - data-driven before/after results"
    ]
  },
  "Lisa Park": {
    age: 52,
    occupation: "Interior Designer",
    location: "Los Gatos, CA",
    visitCount: 15,
    isNewCustomer: false,
    memberSince: "Jun 2024",
    budget: "$2,500+",
    budgetAmount: 3000,
    actualSpend: 3800,
    faceProblem: ["Jawline definition", "Neck laxity", "Volluna loss"],
    therapyPreference: ["Combination treatments", "Premium products", "Comprehensive plans"],
    skinType: "Dry, mature",
    allergies: ["Penicillin"],
    referredBy: null,
    referralsMade: 4,
    referralValue: 6200,
    goals: ["Defined jawline", "Tighter neck", "Natural but visible results"],
    salesTalkingPoints: [
      "High-value client - budget flexible for results",
      "Thread lift was 2 years ago - due for refresh",
      "Comprehensive annual plan opportunity",
      "VIP treatment package with priority booking"
    ]
  }
}

/** Aggregate metrics & charts — lives on Dashboard only */
export function DashboardAnalyticsSection({ clients }: { clients: Client[] }) {
  const monthlyMap = new Map<string, { statedBudget: number; actualSpend: number; ts: number }>()
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  for (const client of clients) {
    const budget = Number(client.budgetStated ?? 0)
    const actual = Number(client.reportActual ?? 0)
    const createdAt = client.createdAt ? new Date(client.createdAt) : null
    if (!createdAt || Number.isNaN(createdAt.getTime())) continue
    const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`
    const prev = monthlyMap.get(key) ?? {
      statedBudget: 0,
      actualSpend: 0,
      ts: createdAt.getTime(),
    }
    monthlyMap.set(key, {
      statedBudget: prev.statedBudget + budget,
      actualSpend: prev.actualSpend + actual,
      ts: prev.ts,
    })
  }

  const monthlyData = [...monthlyMap.entries()]
    .map(([key, value]) => {
      const [year, month] = key.split("-").map(Number)
      const date = new Date(year, month - 1, 1)
      const monthLabel =
        key === currentMonthKey
          ? "Current month"
          : date.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
      return {
        key,
        month: monthLabel,
        statedBudget: Math.round(value.statedBudget),
        actualSpend: Math.round(value.actualSpend),
        ts: value.ts,
      }
    })
    .sort((a, b) => a.ts - b.ts)

  const sumBudget = clients.reduce((acc, c) => acc + Number(c.budgetStated ?? 0), 0)
  const sumActual = clients.reduce((acc, c) => acc + Number(c.reportActual ?? 0), 0)
  const avgBasketPrice = clients.length ? sumActual / clients.length : 0
  const budgetVsActualIncreaseRate = sumBudget > 0 ? ((sumActual - sumBudget) / sumBudget) * 100 : 0
  const basketLift = budgetVsActualIncreaseRate.toFixed(1)
  const budgetVsActualIncreaseRateLabel = `${budgetVsActualIncreaseRate >= 0 ? "+" : ""}${budgetVsActualIncreaseRate.toFixed(1)}%`

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Basket Price</p>
                <p className="text-2xl font-semibold">{formatCurrency(avgBasketPrice)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-success">
              <ArrowUpRight className="h-3 w-3" />
              +{basketLift}% basket lift
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue Increase Rate</p>
                <p className="text-2xl font-semibold">{budgetVsActualIncreaseRateLabel}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className={`mt-2 flex items-center gap-1 text-xs ${budgetVsActualIncreaseRate >= 0 ? "text-success" : "text-warning"}`}>
              {budgetVsActualIncreaseRate >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {budgetVsActualIncreaseRateLabel} actual vs budget
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Basket Chart + Referral Performance side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Budget vs Actual Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(value) => `$${value / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar
                    dataKey="statedBudget"
                    name="Budget"
                    fill="var(--muted)"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="actualSpend"
                    name="Actual"
                    fill="var(--primary)"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <ReferralPerformanceCard totalClients={clients.length} />
      </div>
    </div>
  )
}

export function TopReferrersSection() {
  const [topReferrers, setTopReferrers] = useState<{ name: string; count: number }[]>([])

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const res = await clinicFetch("/api/referrals-from-reports")
        const data = await res.json()
        if (!c && data.topReferrers) setTopReferrers(data.topReferrers)
      } catch {
        if (!c) setTopReferrers([])
      }
    })()
    return () => {
      c = true
    }
  }, [])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Top Referrers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {topReferrers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No referrer data yet.
            </div>
          ) : (
            topReferrers.map((referrer, index) => (
            <div
              key={referrer.name}
              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0
                      ? "bg-yellow-400 text-yellow-900"
                      : index === 1
                        ? "bg-gray-300 text-gray-700"
                        : "bg-amber-600 text-amber-100"
                  }`}
                >
                  {index + 1}
                </div>
                <span className="text-sm font-medium">{referrer.name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">{referrer.count} referrals</span>
              </div>
            </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** Single-client questionnaire report — Report tab only */
export function ClientReportPanel({
  selectedClientReport,
  onCloseClientReport,
  onRefreshClients,
}: ClientReportPanelProps) {
  const [finalText, setFinalText] = useState("")
  const [finalPrice, setFinalPrice] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [aligning, setAligning] = useState(false)
  const [alignedTherapies, setAlignedTherapies] = useState<Record<string, unknown>[]>([])
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({})
  const [menuTreatments, setMenuTreatments] = useState<ClinicMenuTreatment[]>([])

  useEffect(() => {
    clinicFetch("/api/menu-store")
      .then((r) => r.json())
      .then((data: { menu?: { treatments?: unknown } }) => {
        if (Array.isArray(data.menu?.treatments)) {
          setMenuTreatments(data.menu.treatments as ClinicMenuTreatment[])
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const rd = (selectedClientReport?.reportData as Record<string, unknown> | undefined) ?? {}
    const fp = asRec(rd.consultantFinalPlan)
    setFinalPrice(fp.total_price != null ? String(Number(fp.total_price)) : "")
    setFinalText(String(fp.final_plan_text || ""))
    setAlignedTherapies([])
  }, [selectedClientReport?.id])

  const realRd = (selectedClientReport?.reportData as Record<string, unknown> | undefined) ?? {}
  const realUi = asRec(realRd.userInput)
  const realRec = asRec(realRd.recommendation)
  const finalPlan = asRec(realRd.consultantFinalPlan)

  const additionalRecommendations = Array.isArray(realRec?.additionalRecommendations)
    ? (realRec.additionalRecommendations as Record<string, unknown>[])
        .map((r) => ({
          name: String(r.name || ""),
          price: Number(r.price) || 0,
          description: String(r.description || ""),
          duration: String(r.duration || ""),
          downtime: String(r.downtime || ""),
          reason: String(r.reason || ""),
        }))
        .filter((r) => r.name)
    : []

  const beforeYouStepOut = Array.isArray(realRec?.beforeYouStepOut)
    ? (realRec.beforeYouStepOut as Record<string, unknown>[])
        .map((r) => ({
          name: String(r.name || ""),
          price: Number(r.price) || 0,
          description: String(r.description || ""),
        }))
        .filter((r) => r.name)
    : []

  const isEnriched = typeof realRec?.enriched_at === "string" && !!realRec.enriched_at

  const recoveryText =
    realUi.recovery === "lunchtime"
      ? "Minimal downtime"
      : realUi.recovery === "transformative"
        ? "Can accept downtime"
        : "—"

  const isLocalText =
    realUi.isNYC === true ? "Local (NYC)" : realUi.isNYC === false ? "Non-local" : "—"

  const customerStatus =
    realUi.clinicHistory === "returning"
      ? "Returning"
      : realUi.clinicHistory === "new"
        ? "New"
        : "—"

  const budgetNum = Number(realUi.budget) || 0
  const uplift = Number(finalPrice) - budgetNum
  const showUplift = budgetNum > 0 && Number(finalPrice) > 0 && uplift > 0

  return (
    <div className="space-y-4">
      {!selectedClientReport && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          Pick a client on Dashboard to open their questionnaire report. Switching tabs keeps the last report you viewed.
        </div>
      )}

      {selectedClientReport && (
        <div className="space-y-5">
          {/* ── Full-width patient header ── */}
          <div className="flex items-start justify-between rounded-lg border bg-card px-5 py-4">
            <div className="space-y-0.5">
              <h3 className="text-base font-semibold">{selectedClientReport.clientName}</h3>
              <p className="text-sm text-muted-foreground">
                {[customerStatus !== "—" ? customerStatus : null, isLocalText !== "—" ? isLocalText : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
              {budgetNum > 0 && (
                <p className="text-sm font-medium pt-0.5">Budget: ${budgetNum.toLocaleString()}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCloseClientReport}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* ── Asymmetric 2-col: 1/3 left, 2/3 right ── */}
          <div className="grid grid-cols-[1fr_2fr] gap-5 items-start">

            {/* ════ LEFT: Patient Info + Budget Insight ════ */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {([
                    { label: "Name", value: String(realUi.name || selectedClientReport.clientName || "—") },
                    { label: "Budget", value: budgetNum > 0 ? `$${budgetNum.toLocaleString()}` : "—" },
                    { label: "Location", value: isLocalText },
                    { label: "Status", value: customerStatus },
                    { label: "Recovery", value: recoveryText },
                  ] as { label: string; value: string }[]).map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2.5">
                    <p className="text-xs text-muted-foreground mb-1">Goals</p>
                    <p className="text-sm leading-snug">{String(realUi.goals || "—")}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Budget Insight */}
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budget Insight</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Budget</span>
                    <span className="text-sm font-medium">{budgetNum > 0 ? `$${budgetNum.toLocaleString()}` : "—"}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Final Plan</span>
                    <span className="text-sm font-semibold text-primary">
                      {finalPlan?.total_price != null ? `$${Number(finalPlan.total_price).toLocaleString()}` : "—"}
                    </span>
                  </div>
                  {showUplift && (
                    <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-2 text-xs font-semibold text-emerald-700">
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                      +{Math.round((uplift / budgetNum) * 100)}% above budget
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ════ RIGHT: Plans + Add-ons + Final Plan ════ */}
            <div className="space-y-5">
              {menuTreatments.length > 0 && (
                <TreatmentSearchBar treatments={menuTreatments} />
              )}

              {/* Recommended Plans */}
              {Array.isArray(realRec?.plans) && (realRec.plans as Record<string, unknown>[]).length > 0 && (
                <Card className="gap-2">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended Plans</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(realRec.plans as Record<string, unknown>[]).map((plan, idx) => {
                      const key = String(plan.name || idx)
                      const isExpanded = !!expandedPlans[key]
                      const treatments = Array.isArray((plan as Record<string, unknown>).treatments)
                        ? ((plan as Record<string, unknown>).treatments as Record<string, unknown>[])
                        : []
                      const planLabels = ["", "Most popular", "Best value"]
                      const planLabel = planLabels[idx] ?? ""
                      return (
                        <div key={key} className="rounded-md border p-3">
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => setExpandedPlans((s) => ({ ...s, [key]: !s[key] }))}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{String(plan.name || "Plan")}</span>
                                {planLabel && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5">{planLabel}</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm font-semibold">${(Number(plan.totalCost) || 0).toLocaleString()}</span>
                                <span className="text-xs text-muted-foreground">{isExpanded ? "↑" : "↓"}</span>
                              </div>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="mt-3 border-t pt-3 space-y-2">
                              {treatments.map((rawT, tIdx) => {
                                const t: Record<string, unknown> = {
                                  treatmentId: String(rawT.treatmentId || ""),
                                  treatmentName: String(rawT.treatmentName || ""),
                                  role: rawT.role,
                                  description: String(rawT.description || ""),
                                  duration: String(rawT.duration || ""),
                                  downtime: String(rawT.downtime || ""),
                                  reason: String(rawT.reason || ""),
                                  units: rawT.units ?? null,
                                  syringes: rawT.syringes ?? null,
                                  sessions: rawT.sessions ?? null,
                                  fillerType: rawT.fillerType ?? null,
                                  cost: rawT.cost,
                                }
                                const parsed = getTreatmentTags(t)
                                const displayCost = resolveDisplayCost(t)
                                return (
                                  <div key={`${String(t.treatmentId || t.treatmentName || tIdx)}-${tIdx}`} className="rounded border p-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-medium">{treatmentLabelFromUnknown(t)}</p>
                                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                                        {parsed.effectDuration && (
                                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700">Lasts {parsed.effectDuration}</span>
                                        )}
                                        {parsed.downtime && (
                                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700">Recovery: {parsed.downtime}</span>
                                        )}
                                        <p className="text-xs font-medium ml-1">{displayCost != null ? `$${displayCost.toLocaleString()}` : "—"}</p>
                                      </div>
                                    </div>
                                    {parsed.description && (
                                      <p className="text-xs text-muted-foreground mt-1">{parsed.description}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {t.units ? `${t.units} units ` : ""}
                                      {t.syringes ? `${t.syringes} syringe${Number(t.syringes) > 1 ? "s" : ""} ${String(t.fillerType || "")} ` : ""}
                                      {t.sessions ? `${t.sessions} session${Number(t.sessions) > 1 ? "s" : ""}` : ""}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Additional Recommendations */}
              {additionalRecommendations.length > 0 ? (
                <Card className="gap-2">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {additionalRecommendations.map((r, i) => {
                      const parsedR = getTreatmentTags(r)
                      return (
                        <div key={i} className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{r.name}</p>
                            <div className="flex items-center gap-1 shrink-0">
                              {parsedR.effectDuration && (
                                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700">Lasts {parsedR.effectDuration}</span>
                              )}
                              {parsedR.downtime && (
                                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700">Recovery: {parsedR.downtime}</span>
                              )}
                              <p className="text-sm font-semibold ml-1">${r.price.toLocaleString()}</p>
                            </div>
                          </div>
                          {parsedR.description && (
                            <p className="text-xs text-muted-foreground mt-1">{parsedR.description}</p>
                          )}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              ) : !isEnriched ? (
                <Card className="gap-2">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 animate-pulse">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-start justify-between gap-3 rounded-md border bg-muted/20 p-3">
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-36 rounded bg-muted" />
                          <div className="h-2.5 w-full rounded bg-muted" />
                        </div>
                        <div className="h-3 w-12 rounded bg-muted shrink-0" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              {/* Before You Step Out */}
              {beforeYouStepOut.length > 0 && (
                <Card className="gap-2">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Before You Step Out</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {beforeYouStepOut.map((r, i) => (
                      <div key={i} className="rounded-md border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{r.name}</p>
                          <p className="text-sm font-semibold ml-1 shrink-0">${r.price.toLocaleString()}</p>
                        </div>
                        {r.description && (
                          <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Final Plan */}
              <Card className="gap-2">
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Final Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <textarea
                    className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm"
                    placeholder="Final plan notes for the file…"
                    value={finalText}
                    onChange={(e) => setFinalText(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2 items-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={aligning || !finalText.trim()}
                      onClick={async () => {
                        setAligning(true)
                        try {
                          const res = await fetch("/api/align-final-plan", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ consultantText: finalText }),
                          })
                          const data = await res.json()
                          if (res.ok && data.result) {
                            setAlignedTherapies(data.result.therapies || [])
                            setFinalPrice(String(data.result.total_price ?? ""))
                          }
                        } finally {
                          setAligning(false)
                        }
                      }}
                    >
                      {aligning ? "Aligning…" : "Align with menu (AI)"}
                    </Button>
                  </div>
                  {alignedTherapies.length > 0 && (
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                      {alignedTherapies.map((t, i) => (
                        <li key={i}>
                          {(t.treatmentName as string) || (t.treatmentId as string)} ~ ${Number(t.linePrice) || 0}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      placeholder="Total price"
                      value={finalPrice}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFinalPrice(e.target.value)}
                      className="max-w-[160px]"
                    />
                    <Button
                      size="sm"
                      disabled={submitting || !selectedClientReport.sessionId || finalPrice.trim() === ""}
                      onClick={async () => {
                        if (!selectedClientReport.sessionId) return
                        setSubmitting(true)
                        try {
                          const res = await clinicFetch("/api/final-solution", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              sessionId: selectedClientReport.sessionId,
                              reportId: selectedClientReport.id,
                              final_plan_text: finalText,
                              total_price: Number(finalPrice),
                              therapies: alignedTherapies,
                            }),
                          })
                          if (res.ok) {
                            onRefreshClients?.()
                          }
                        } finally {
                          setSubmitting(false)
                        }
                      }}
                    >
                      {submitting ? "Saving…" : "Save"}
                    </Button>
                  </div>
                  {showUplift && (
                    <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                      <ArrowUpRight className="h-4 w-4 shrink-0" />
                      <span>Budget uplift: <strong>+${uplift.toLocaleString()}</strong> above stated budget</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

