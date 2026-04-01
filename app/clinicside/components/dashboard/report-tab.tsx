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

interface ClientReportPanelProps {
  selectedClientReport?: ClientNotification | null
  onCloseClientReport?: () => void
  onRefreshClients?: () => void
}

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
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

  const clientReport = selectedClientReport ? mockClientReports[selectedClientReport.clientName] : null
  const allowMockReport = false

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

  return (
    <div className="space-y-6">
      {/* Client Report Panel — live Supabase report_data */}
      {selectedClientReport && (
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{selectedClientReport.clientName}</h3>
              <p className="text-sm text-muted-foreground">
                {emailText} · {phoneText}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCloseClientReport}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Budget (stated)</p>
              <p className="font-medium">${Number(realUi.budget) || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Actual (final plan)</p>
              <p className="font-medium text-primary">
                {finalPlan?.total_price != null
                  ? `$${Number(finalPlan.total_price)}`
                  : "—"}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Goals</h4>
            <p className="text-sm">{String(realUi.goals || "—")}</p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Survey details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{String(realUi.name || selectedClientReport.clientName || "—")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Age</p>
                <p className="font-medium">{String(realUi.age || "—")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Occupation</p>
                <p className="font-medium">{String(realUi.occupation || "—")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Customer status</p>
                <p className="font-medium">
                  {realUi.clinicHistory === "returning" ? "Returning" : realUi.clinicHistory === "new" ? "New" : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Experience</p>
                <p className="font-medium">{experienceText}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recovery preference</p>
                <p className="font-medium">{recoveryText}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Location status</p>
                <p className="font-medium">{isLocalText}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Referral contact</p>
                <p className="font-medium">{String(realUi.referral || "—")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Photo provided</p>
                <p className="font-medium">{realUi.photoPresent ? "Yes" : hasRealUi ? "No" : "—"}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Patient summary</h4>
            <p className="text-sm whitespace-pre-wrap">{String(realRec?.summary || "—")}</p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Consultant brief</h4>
            <div className="space-y-3">
              <div className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Consumption capability</p>
                  <Badge variant="secondary">{consultantBrief.consumptionCapability.score}/5 · {consultantBrief.consumptionCapability.tier}</Badge>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${consultantBrief.consumptionCapability.score * 20}%` }} />
                </div>
                <p className="text-sm mt-2">{consultantBrief.consumptionCapability.reason}</p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Long-term possibility</p>
                  <Badge variant="secondary">
                    {consultantBrief.longTermPossibility.score}/5 · {consultantBrief.longTermPossibility.tier}
                  </Badge>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${consultantBrief.longTermPossibility.score * 20}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Client status: {consultantBrief.longTermPossibility.isReturning}</p>
                <p className="text-sm mt-1">{consultantBrief.longTermPossibility.reason}</p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Referral ability</p>
                  <Badge variant="secondary">{consultantBrief.referralAbility.score}/5 · {consultantBrief.referralAbility.tier}</Badge>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${consultantBrief.referralAbility.score * 20}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Local: {consultantBrief.referralAbility.isLocal}
                </p>
                <p className="text-sm mt-1">{consultantBrief.referralAbility.reason}</p>
              </div>
            </div>
          </div>

          {Array.isArray(realRec?.plans) && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                AI recommended therapies
              </h4>
              <div className="space-y-3">
                {(realRec.plans as Record<string, unknown>[]).map((plan, idx) => {
                  const key = String(plan.name || idx)
                  const isExpanded = !!expandedPlans[key]
                  const treatments = Array.isArray((plan as Record<string, unknown>).treatments)
                    ? ((plan as Record<string, unknown>).treatments as Record<string, unknown>[])
                    : []

                  return (
                    <div key={key} className="rounded-md border bg-background p-3 text-sm">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() =>
                          setExpandedPlans((s) => ({
                            ...s,
                            [key]: !s[key],
                          }))
                        }
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium">
                            {String(plan.name || "Plan")} — {String(plan.tagline || "")}
                          </p>
                          <p className="text-xs text-muted-foreground">
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
                          {treatments.map((t, tIdx) => (
                            <div key={`${String(t.treatmentId || t.treatmentName || tIdx)}-${tIdx}`} className="rounded border p-2">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{treatmentLabelFromUnknown(t)}</p>
                                <p className="text-xs">${Number(t.cost) || 0}</p>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t.units ? `${t.units} units ` : ""}
                                {t.syringes ? `${t.syringes} syringe${Number(t.syringes) > 1 ? "s" : ""} ${String(t.fillerType || "")} ` : ""}
                                {t.sessions ? `${t.sessions} session${Number(t.sessions) > 1 ? "s" : ""}` : ""}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">{String(t.reason || "—")}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Sales methodology</h4>
            {salesMethodology ? (
              <div className="space-y-2">
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Combo synergy</p>
                  <p className="text-sm whitespace-pre-wrap">{salesMethodology.comboSynergy}</p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Treatment effectiveness</p>
                  <p className="text-sm whitespace-pre-wrap">{salesMethodology.treatmentEffectiveness}</p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Campaign + referral discount</p>
                  <p className="text-sm whitespace-pre-wrap">{salesMethodology.campaignAndReferral}</p>
                </div>
              </div>
            ) : salesSentences.length > 0 ? (
              <div className="space-y-2">
                {salesSentences.map((row, idx) => (
                  <div key={`${row.type}-${idx}`} className="rounded-md border bg-background p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{row.type}</p>
                    <p className="text-sm whitespace-pre-wrap">{row.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sales methodology generated yet.</p>
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <h4 className="text-sm font-medium">Submit final plan</h4>
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
                    {(t.treatmentName as string) || (t.treatmentId as string)} ~ $
                    {Number(t.linePrice) || 0}
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
                      setFinalText("")
                      setFinalPrice("")
                      setAlignedTherapies([])
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
          </div>
        </div>
      )}

      {/* Client Report Panel — legacy mock */}
      {selectedClientReport && allowMockReport && clientReport && !realUi && (
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-5">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">
                  {selectedClientReport.clientName.split(" ").map(n => n[0]).join("")}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{selectedClientReport.clientName}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{clientReport.age} years old</span>
                  <span>·</span>
                  <span>{clientReport.occupation}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={clientReport.isNewCustomer ? "outline" : "default"} className={!clientReport.isNewCustomer ? "bg-primary" : ""}>
                {clientReport.isNewCustomer ? "New Customer" : `Visit #${clientReport.visitCount}`}
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCloseClientReport}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Quick Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-5 p-3 bg-background rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="text-sm font-medium">{clientReport.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Member Since</p>
                <p className="text-sm font-medium">{clientReport.memberSince}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Budget / Actual</p>
                <p className="text-sm font-medium">
                  ${clientReport.budgetAmount} / <span className="text-primary">${clientReport.actualSpend}</span>
                  {clientReport.actualSpend > clientReport.budgetAmount && (
                    <span className="text-success text-xs ml-1">
                      +{((clientReport.actualSpend - clientReport.budgetAmount) / clientReport.budgetAmount * 100).toFixed(0)}%
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Referrals Made</p>
                <p className="text-sm font-medium">{clientReport.referralsMade} <span className="text-muted-foreground">(${clientReport.referralValue} value)</span></p>
              </div>
            </div>
          </div>
          
          <div className="grid gap-5 md:grid-cols-3">
            {/* Column 1: Problems & Preferences */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  Face Problems
                </h4>
                <ul className="space-y-1">
                  {clientReport.faceProblem.map((problem, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {problem}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Skin Type</h4>
                <p className="text-sm">{clientReport.skinType}</p>
              </div>
              {clientReport.allergies.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Allergies</h4>
                  <div className="flex gap-1 flex-wrap">
                    {clientReport.allergies.map((allergy, i) => (
                      <Badge key={i} variant="destructive" className="text-xs">{allergy}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Column 2: Therapy Preferences & Goals */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Therapy Preferences
                </h4>
                <ul className="space-y-1">
                  {clientReport.therapyPreference.map((pref, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                      {pref}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Goals</h4>
                <ul className="space-y-1">
                  {clientReport.goals.map((goal, i) => (
                    <li key={i} className="text-sm">{goal}</li>
                  ))}
                </ul>
              </div>
              {clientReport.referredBy && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Referred By</h4>
                  <p className="text-sm font-medium text-primary">{clientReport.referredBy}</p>
                </div>
              )}
            </div>
            
            {/* Column 3: Sales Talking Points */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                Sales Talking Points
              </h4>
              <ul className="space-y-2">
                {clientReport.salesTalkingPoints.map((point, i) => (
                  <li key={i} className="text-sm flex items-start gap-2 p-2 rounded bg-background">
                    <span className="text-xs font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0">{i + 1}</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {!selectedClientReport && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          Pick a client on Dashboard to open their questionnaire report. Switching tabs keeps the last report you viewed.
        </div>
      )}
    </div>
  )
}
