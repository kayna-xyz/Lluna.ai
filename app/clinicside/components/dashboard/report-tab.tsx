"use client"

import { useEffect, useState } from "react"
import type { ChangeEvent } from "react"
import { DollarSign, Target, X, Sparkles, ArrowUpRight, ArrowDownRight, MapPin, Calendar, Users, Heart, Clock } from "lucide-react"
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
import type { Client } from "../../lib/data"
import { MENU_BY_ID } from "../../../../lib/clinic-menu"
import { RECOVERY_RULES } from "../../../../lib/treatment-price-resolver"
import { firstNumericPriceForTreatment } from "../../../../lib/recommend-menu"

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

/** Normalize a duration tag to a clean numeric range. Returns "" if unparseable. */
function normalizeDurationTag(raw: string): string {
  const s = raw.trim()
  if (!s) return ""
  if (/^permanent$/i.test(s)) return "Permanent"
  const normalized = s
    .replace(/\s+to\s+/gi, "–")
    .replace(/\s*[-—]\s*/g, "–")
  if (!/\d/.test(normalized)) return ""
  return normalized
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

/** Prefer native structured fields; fall back to parsing legacy reason string for old reports. */
function getTreatmentTags(t: Record<string, unknown>): { description: string; duration: string; downtime: string } {
  let description = String(t.description || "").trim()
  let duration = String(t.duration || "").trim()
  let downtime = String(t.downtime || "").trim()
  if (!duration || !downtime) {
    // Legacy fallback: parse from reason string
    const raw = String(t.reason || "").trim()
    const [line1 = "", line2 = ""] = raw.split("\n")
    if (!description) description = line1.trim()
    if (!duration) duration = line2.match(/Duration:\s*([^|]+)/i)?.[1]?.trim() || ""
    if (!downtime) downtime = line2.match(/Downtime:\s*([^|]+)/i)?.[1]?.trim() || ""
  }
  const treatmentName = String(t.treatmentName || t.name || "")
  return {
    description,
    duration: normalizeDurationTag(duration),
    downtime: normalizeRecoveryTag(downtime, treatmentName),
  }
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

      {/* Basket Chart */}
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

  // Seed inputs from DB whenever the selected report changes (different client or fresh load)
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
  const hasRealUi = Object.keys(realUi).length > 0
  const emailText = String(realUi.email || "—")
  const phoneText = String(realUi.phone || "—")
  const consultantBriefText = String(
    realRec?.consultantProfileSummary ||
      selectedClientReport?.reportSummary ||
      "—",
  )
  const briefRaw = asRec(realRec?.consultantBrief)
  const consultantBrief = Object.keys(briefRaw).length
    ? {
        consumptionCapability: {
          score: clampScore(asRec(briefRaw.consumptionCapability).score),
          tier: normTier(asRec(briefRaw.consumptionCapability).tier),
          reason: String(asRec(briefRaw.consumptionCapability).reason || "No note."),
        },
        longTermPossibility: {
          score: clampScore(asRec(briefRaw.longTermPossibility).score),
          tier: normTier(asRec(briefRaw.longTermPossibility).tier),
          reason: String(asRec(briefRaw.longTermPossibility).reason || "No note."),
          isReturning: String(asRec(briefRaw.longTermPossibility).isReturning || "unknown"),
        },
        referralAbility: {
          score: clampScore(asRec(briefRaw.referralAbility).score),
          tier: normTier(asRec(briefRaw.referralAbility).tier),
          reason: String(asRec(briefRaw.referralAbility).reason || "No note."),
          isLocal: String(asRec(briefRaw.referralAbility).isLocal || "unknown"),
        },
      }
    : parseLegacyBriefText(consultantBriefText)

  const salesMethodologyRaw = asRec(realRec?.salesMethodology)
  const salesMethodology = Object.keys(salesMethodologyRaw).length
    ? {
        comboSynergy: String(salesMethodologyRaw.comboSynergy || "—"),
        treatmentEffectiveness: String(salesMethodologyRaw.treatmentEffectiveness || "—"),
        campaignAndReferral: String(salesMethodologyRaw.campaignAndReferral || "—"),
      }
    : null
  const salesSentences = Array.isArray(realRec?.salesSentences)
    ? (realRec.salesSentences as { type?: unknown; text?: unknown }[])
        .map((x) => ({
          type: String(x.type || ""),
          text: String(x.text || ""),
        }))
        .filter((x) => x.type && x.text)
        .slice(0, 3)
    : []

  const salesMethodologyNewRaw = asRec(realRec?.salesMethodologyNew)
  const salesMethodologyNew =
    Array.isArray(salesMethodologyNewRaw.patient_insight) && Array.isArray(salesMethodologyNewRaw.sales_angles)
      ? {
          patient_insight: (salesMethodologyNewRaw.patient_insight as unknown[]).map((x) => String(x)).filter(Boolean),
          sales_angles: (salesMethodologyNewRaw.sales_angles as unknown[]).map((x) => String(x)).filter(Boolean),
        }
      : null

  const additionalRecommendations = Array.isArray(realRec?.additionalRecommendations)
    ? (realRec.additionalRecommendations as Record<string, unknown>[])
        .map((r) => ({
          name: String(r.name || ""),
          price: Number(r.price) || 0,
          description: String(r.description || ""),
          duration: String(r.duration || ""),
          downtime: String(r.downtime || ""),
          // keep legacy reason for consumer-side backwards compat
          reason: String(r.reason || ""),
        }))
        .filter((r) => r.name)
    : []

  const patientSummaryStructuredRaw = asRec(realRec?.patientSummaryStructured)
  const patientSummary =
    typeof patientSummaryStructuredRaw.summary === "string" && patientSummaryStructuredRaw.summary.trim()
      ? patientSummaryStructuredRaw.summary.trim()
      : typeof realRec?.summary === "string"
        ? (realRec.summary as string)
        : null

  const isEnriched = typeof realRec?.enriched_at === "string" && !!realRec.enriched_at

  const budgetLabel = (() => {
    const b = Number(realUi.budget ?? realUi.budgetNum ?? 0)
    return b > 0 ? `$${b.toLocaleString()} budget` : ""
  })()

  // Recompute long-term possibility score from deterministic formula
  const ltpIsLocal = consultantBrief.referralAbility.isLocal === "yes"
  const ltpTier = consultantBrief.consumptionCapability.tier
  const ltpPurchasing = ltpTier === "Premium" ? "high" : ltpTier === "Mid" ? "mid" : "low"
  const ltpScore = Math.min(5,
    (ltpIsLocal ? 3 : 0) +
    (ltpPurchasing === "mid" ? 1 : 0) +
    (ltpPurchasing === "high" ? 2 : 0),
  ) || 1

  const experienceText =
    realUi.experience === "first"
      ? "First-time"
      : realUi.experience === "few"
        ? "Some prior treatments"
        : realUi.experience === "regular"
          ? "Regular treatments"
          : "—"
  const recoveryText =
    realUi.recovery === "lunchtime"
      ? "Minimal downtime"
      : realUi.recovery === "transformative"
        ? "Can accept downtime"
        : "—"
  const isLocalText =
    realUi.isNYC === true ? "Local (NYC)" : realUi.isNYC === false ? "Non-local" : "—"

  // Budget uplift calculation
  const budgetNum = Number(realUi.budget) || 0
  const finalPriceNum = Number(finalPrice) || 0
  const uplift = finalPriceNum - budgetNum
  const showUplift = budgetNum > 0 && finalPriceNum > 0 && uplift > 0

  return (
    <div className="space-y-4">
      {/* Empty state */}
      {!selectedClientReport && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          Pick a client on Dashboard to open their questionnaire report. Switching tabs keeps the last report you viewed.
        </div>
      )}

      {selectedClientReport && (
        <div className="space-y-4">
          {/* Header strip */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{selectedClientReport.clientName}</h3>
              <p className="text-sm text-muted-foreground">{emailText} · {phoneText}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCloseClientReport}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* ── Two-column grid ── */}
          <div className="grid grid-cols-2 gap-5 items-start">

            {/* ════ LEFT COLUMN ════ */}
            <div className="space-y-5">

              {/* Card 0: Consultant Brief — top-left */}
              <Card className="gap-2">
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consultant Brief</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">

                    {/* Purchasing Power */}
                    <div className="flex flex-col rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Purchasing Power</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold leading-none">{consultantBrief.consumptionCapability.score}</span>
                        <span className="text-xs text-muted-foreground">/5</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">{consultantBrief.consumptionCapability.tier}</Badge>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${consultantBrief.consumptionCapability.score * 20}%` }} />
                      </div>
                      {budgetLabel && (
                        <p className="text-[10px] text-muted-foreground">{budgetLabel}</p>
                      )}
                    </div>

                    {/* Long-term Possibility */}
                    <div className="flex flex-col rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Long-term Possibility</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold leading-none">{ltpScore}</span>
                        <span className="text-xs text-muted-foreground">/5</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">{consultantBrief.longTermPossibility.tier}</Badge>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${ltpScore * 20}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground capitalize">{consultantBrief.longTermPossibility.isReturning}</p>
                    </div>

                    {/* Referral Ability */}
                    <div className="flex flex-col rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Referral Ability</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold leading-none">{consultantBrief.referralAbility.score}</span>
                        <span className="text-xs text-muted-foreground">/5</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">{consultantBrief.referralAbility.tier}</Badge>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${consultantBrief.referralAbility.score * 20}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Local: {consultantBrief.referralAbility.isLocal}</p>
                    </div>

                  </div>
                </CardContent>
              </Card>

              {/* Card 1: Patient Info */}
              <Card className="gap-2">
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Uplift notification */}
                  {showUplift && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        +${uplift.toLocaleString()} above stated budget
                      </p>
                      <span className="ml-auto text-[10px] text-emerald-600/70 dark:text-emerald-500 shrink-0">
                        {Math.round((uplift / budgetNum) * 100)}% lift
                      </span>
                    </div>
                  )}

                  {/* Budget summary row */}
                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Budget (stated)</p>
                      <p className="font-medium">{budgetNum > 0 ? `$${budgetNum}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Actual (final plan)</p>
                      <p className="font-medium text-primary">
                        {finalPlan?.total_price != null ? `$${Number(finalPlan.total_price)}` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Goals */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Goals</p>
                    <p className="text-sm">{String(realUi.goals || "—")}</p>
                  </div>

                  {/* All available info fields */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Details</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      {([
                        { label: "Name", value: String(realUi.name || selectedClientReport.clientName || "—") },
                        { label: "Email", value: emailText },
                        { label: "Phone", value: phoneText },
                        { label: "Age", value: String(realUi.age || "—") },
                        { label: "Occupation", value: String(realUi.occupation || "—") },
                        {
                          label: "Customer status",
                          value:
                            realUi.clinicHistory === "returning"
                              ? "Returning"
                              : realUi.clinicHistory === "new"
                                ? "New"
                                : "—",
                        },
                        { label: "Experience", value: experienceText },
                        { label: "Recovery pref.", value: recoveryText },
                        { label: "Location", value: isLocalText },
                        { label: "Referral contact", value: String(realUi.referral || "—") },
                        {
                          label: "Photo provided",
                          value: realUi.photoPresent ? "Yes" : hasRealUi ? "No" : "—",
                        },
                      ] as { label: string; value: string }[]).map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="font-medium">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI patient summary */}
                  {patientSummary ? (
                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">AI Patient Summary</p>
                      <p className="text-sm whitespace-pre-wrap">{patientSummary}</p>
                    </div>
                  ) : !isEnriched ? (
                    <div className="border-t pt-3 space-y-1.5 animate-pulse">
                      <div className="h-3 w-28 rounded bg-muted" />
                      <div className="h-3 w-full rounded bg-muted" />
                      <div className="h-3 w-4/5 rounded bg-muted" />
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Card 2: Sales Methodology */}
              <Card className="gap-2">
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales Methodology</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {salesMethodologyNew ? (
                    <>
                      {salesMethodologyNew.sales_angles.length > 0 && (
                        <div className="rounded-md border bg-primary/5 border-primary/20 p-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Sales Angles</p>
                          <ul className="space-y-1">
                            {salesMethodologyNew.sales_angles.map((item, i) => (
                              <li key={i} className="text-sm flex gap-2">
                                <span className="text-primary shrink-0">→</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : salesMethodology ? (
                    <>
                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Combo synergy</p>
                        <p className="text-sm whitespace-pre-wrap">{salesMethodology.comboSynergy}</p>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Treatment effectiveness</p>
                        <p className="text-sm whitespace-pre-wrap">{salesMethodology.treatmentEffectiveness}</p>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Campaign + referral</p>
                        <p className="text-sm whitespace-pre-wrap">{salesMethodology.campaignAndReferral}</p>
                      </div>
                    </>
                  ) : salesSentences.length > 0 ? (
                    <div className="space-y-2">
                      {salesSentences.map((row, idx) => (
                        <div key={`${row.type}-${idx}`} className="rounded-md border bg-muted/30 p-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{row.type}</p>
                          <p className="text-sm whitespace-pre-wrap">{row.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : !isEnriched ? (
                    <div className="space-y-2 animate-pulse">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                          <div className="h-2.5 w-24 rounded bg-muted" />
                          <div className="h-3 w-full rounded bg-muted" />
                          <div className="h-3 w-3/4 rounded bg-muted" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No sales methodology generated yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ════ RIGHT COLUMN ════ */}
            <div className="space-y-5">

              {/* Card 4: Recommended Plans */}
              {Array.isArray(realRec?.plans) && (realRec.plans as Record<string, unknown>[]).length > 0 && (
                <Card className="gap-2">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended Plans</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(realRec.plans as Record<string, unknown>[]).map((plan, idx) => {
                      const key = String(plan.name || idx)
                      const isExpanded = !!expandedPlans[key]
                      const treatments = Array.isArray((plan as Record<string, unknown>).treatments)
                        ? ((plan as Record<string, unknown>).treatments as Record<string, unknown>[])
                        : []
                      return (
                        <div key={key} className="rounded-md border bg-muted/20 p-3 text-sm">
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => setExpandedPlans((s) => ({ ...s, [key]: !s[key] }))}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium">
                                {String(plan.name || "Plan")}
                              </p>
                              <p className="text-xs text-muted-foreground ml-2 shrink-0">
                                {isExpanded ? "Hide details" : "Show details"}
                              </p>
                            </div>
                            <p className="text-muted-foreground text-xs mt-1">
                              Total ~ ${Number(plan.totalCost) || 0}
                            </p>
                          </button>
                          {isExpanded && (
                            <div className="mt-3 border-t pt-3 space-y-3">
                              <p className="text-xs text-muted-foreground">{String(plan.whyThisPlan || "—")}</p>
                              <p className="text-xs text-muted-foreground">{String(plan.synergyNote || "—")}</p>
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
                                  <div
                                    key={`${String(t.treatmentId || t.treatmentName || tIdx)}-${tIdx}`}
                                    className="rounded border p-2"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="font-medium text-sm">{treatmentLabelFromUnknown(t)}</p>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {parsed.duration && (
                                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">Duration: {parsed.duration}</span>
                                        )}
                                        {parsed.downtime && (
                                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">Recovery: {parsed.downtime}</span>
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

              {/* Card 4b: Additional Recommendations */}
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
                              {parsedR.duration && (
                                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">Duration: {parsedR.duration}</span>
                              )}
                              {parsedR.downtime && (
                                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">Recovery: {parsedR.downtime}</span>
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

              {/* Card 5: Final Plan + Final Price */}
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
                      disabled={
                        submitting ||
                        !selectedClientReport.sessionId ||
                        finalPrice.trim() === ""
                      }
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

                  {/* Budget uplift indicator */}
                  {showUplift && (
                    <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                      <ArrowUpRight className="h-4 w-4 shrink-0" />
                      <span>
                        Budget uplift: <strong>+${uplift.toLocaleString()}</strong> above stated budget
                      </span>
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
