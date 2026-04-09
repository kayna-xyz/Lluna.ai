"use client"

import { useEffect, useState } from "react"
import type { ChangeEvent } from "react"
import { DollarSign, Target, X, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ClientNotification } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import type { ClinicMenuTreatment } from "../../../../lib/clinic-menu"
import { TreatmentSearchBar } from "./treatment-search"

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
  const [alignedTherapies, setAlignedTherapies] = useState<Record<string, unknown>[]>([])
  // expandedPlans removed — plans now shown as side-by-side cards
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

  const isEnriched = typeof realRec?.enriched_at === "string" && !!realRec.enriched_at

  // Category-based recommendations (enrichment schema)
  const categoryRecommendations = Array.isArray(realRec?.categoryRecommendations)
    ? (realRec.categoryRecommendations as Record<string, unknown>[]).map((cat) => ({
        name: String(cat.name || ""),
        treatments: Array.isArray(cat.treatments)
          ? (cat.treatments as Record<string, unknown>[]).map((t) => ({
              treatmentId: String(t.treatmentId || ""),
              treatmentName: String(t.treatmentName || ""),
              description: String(t.description || ""),
              cost: Number(t.cost) || 0,
              duration: String(t.duration || ""),
              downtime: String(t.downtime || ""),
              units: t.units != null ? Number(t.units) : null,
              syringes: t.syringes != null ? Number(t.syringes) : null,
              sessions: t.sessions != null ? Number(t.sessions) : null,
              fillerType: t.fillerType != null ? String(t.fillerType) : null,
            }))
          : [],
      })).filter((cat) => cat.name && cat.treatments.length > 0)
    : []

  // Fallback: plans from the original AI recommendation (Essential / Optimal / Premium)
  const planFallbacks = Array.isArray(realRec?.plans)
    ? (realRec.plans as Record<string, unknown>[]).map((plan) => ({
        name: String(plan.name || ""),
        comboPrice: Number(plan.comboPrice) || 0,
        treatments: Array.isArray(plan.treatments)
          ? (plan.treatments as Record<string, unknown>[]).map((t) => ({
              treatmentId: String(t.treatmentId || ""),
              treatmentName: String(t.treatmentName || ""),
              description: String(t.description || t.reason || ""),
              cost: Number(t.cost) || 0,
              units: t.units != null ? Number(t.units) : null,
              syringes: t.syringes != null ? Number(t.syringes) : null,
            }))
          : [],
      })).filter((p) => p.name && p.treatments.length > 0)
    : []

  const zeroCostAddOns = Array.isArray(realRec?.zeroCostAddOns)
    ? (realRec.zeroCostAddOns as Record<string, unknown>[]).map((t) => ({
        treatmentId: String(t.treatmentId || ""),
        treatmentName: String(t.treatmentName || ""),
        description: String(t.description || ""),
        cost: Number(t.cost) || 0,
      })).filter((t) => t.treatmentName)
    : []

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

  return (
    <div className="space-y-4">
      {!selectedClientReport && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          Pick a client on Dashboard to open their questionnaire report. Switching tabs keeps the last report you viewed.
        </div>
      )}

      {selectedClientReport && (
        <div className="space-y-5">
          {/* ── Asymmetric 2-col: 1/3 left, 2/3 right ── */}
          <div className="grid grid-cols-[1fr_2fr] gap-5 items-start">

            {/* ════ LEFT: Patient Info + Goals + Final Plan ════ */}
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
                    { label: "Preference", value: recoveryText },
                  ] as { label: string; value: string }[]).map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Client Goals */}
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Goals</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-snug">{String(realUi.goals || "—")}</p>
                </CardContent>
              </Card>

              {/* Final Plan */}
              <Card className="gap-2">
                <CardHeader className="pb-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Final Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <textarea
                    className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm"
                    placeholder="Notes…"
                    value={finalText}
                    onChange={(e) => setFinalText(e.target.value)}
                  />
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
                </CardContent>
              </Card>
            </div>

            {/* ════ RIGHT: Category Recommendations + 0 Cost to Ask ════ */}
            <div className="space-y-5">
              {menuTreatments.length > 0 && (
                <TreatmentSearchBar treatments={menuTreatments} />
              )}

              {/* helper — inline so it closes over menuTreatments */}
              {(() => {
                const getMenuTags = (treatmentId: string): string[] => {
                  const mt = menuTreatments.find((m) => m.id === treatmentId)
                  return Array.isArray(mt?.tags) ? (mt!.tags as string[]) : []
                }
                const TagPills = ({ treatmentId }: { treatmentId: string }) => {
                  const tags = getMenuTags(treatmentId)
                  if (!tags.length) return null
                  return (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )
                }

                return (
                  <>
                {/* Category-based recommendations (enriched) — or plan fallback */}
                {categoryRecommendations.length > 0 ? (
                  categoryRecommendations.map((cat) => (
                    <Card key={cat.name} className="gap-2">
                      <CardHeader className="pb-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {cat.treatments.map((t, i) => (
                          <div key={`${t.treatmentId}-${i}`} className="rounded-md border bg-muted/20 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium">{t.treatmentName}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                {t.duration && (
                                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700">Lasts {t.duration}</span>
                                )}
                                {t.downtime && t.downtime !== "None" && (
                                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-orange-50 text-orange-700">↓ {t.downtime}</span>
                                )}
                                {t.cost > 0 && (
                                  <p className="text-sm font-semibold ml-1">${t.cost.toLocaleString()}</p>
                                )}
                              </div>
                            </div>
                            {t.description && (
                              <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                            )}
                            {(t.units || t.syringes || t.sessions) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t.units ? `${t.units} units ` : ""}
                                {t.syringes ? `${t.syringes} syringe${t.syringes > 1 ? "s" : ""} ${t.fillerType || ""} ` : ""}
                                {t.sessions ? `${t.sessions} session${t.sessions > 1 ? "s" : ""}` : ""}
                              </p>
                            )}
                            <TagPills treatmentId={t.treatmentId} />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))
                ) : planFallbacks.length > 0 ? (
                  // Fallback: show AI-recommended plans (Essential / Optimal / Premium)
                  planFallbacks.map((plan) => (
                    <Card key={plan.name} className="gap-2">
                      <CardHeader className="pb-0">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{plan.name} Plan</CardTitle>
                          {plan.comboPrice > 0 && (
                            <span className="text-sm font-semibold">${plan.comboPrice.toLocaleString()}</span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {plan.treatments.map((t, i) => (
                          <div key={`${t.treatmentId}-${i}`} className="rounded-md border bg-muted/20 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium">{t.treatmentName}</p>
                              {t.cost > 0 && (
                                <p className="text-sm font-semibold shrink-0">${t.cost.toLocaleString()}</p>
                              )}
                            </div>
                            {t.description && (
                              <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                            )}
                            {(t.units || t.syringes) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t.units ? `${t.units} units ` : ""}
                                {t.syringes ? `${t.syringes} syringe${t.syringes > 1 ? "s" : ""}` : ""}
                              </p>
                            )}
                            <TagPills treatmentId={t.treatmentId} />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))
                ) : !isEnriched ? (
                // Loading skeleton while enrichment runs
                <Card className="gap-2">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 animate-pulse">
                    {[1, 2, 3].map((i) => (
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
              ) : (
                <p className="text-xs text-muted-foreground">No recommendations available.</p>
              )}

              {/* 0 Cost to Ask */}
              {zeroCostAddOns.length > 0 && (
                <Card className="gap-2">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">0 Cost to Ask</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {zeroCostAddOns.map((t, i) => (
                      <div key={`${t.treatmentId}-${i}`} className="rounded-md border bg-muted/20 p-3">
                        <p className="text-sm font-medium">{t.treatmentName}</p>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                        )}
                        <TagPills treatmentId={t.treatmentId} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
                  </>
                )
              })()}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

