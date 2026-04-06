"use client"

import { useEffect, useState } from "react"
import { Users, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { clinicFetch } from "@/app/clinicside/lib/clinic-api"

interface ReferralPerformanceCardProps {
  totalClients: number
}

export function ReferralPerformanceCard({ totalClients }: ReferralPerformanceCardProps) {
  const [referralSubmissions, setReferralSubmissions] = useState(0)
  const [referralBonusPerClient, setReferralBonusPerClient] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [referralsRes, settingsRes] = await Promise.all([
          clinicFetch("/api/referrals-from-reports"),
          clinicFetch("/api/clinic-settings"),
        ])
        const [referralsData, settingsData] = await Promise.all([
          referralsRes.json(),
          settingsRes.json(),
        ])
        if (cancelled) return
        setReferralSubmissions(Array.isArray(referralsData.referrals) ? referralsData.referrals.length : 0)
        setReferralBonusPerClient(typeof settingsData.referBonusUsd === "number" ? settingsData.referBonusUsd : 0)
      } catch {
        // leave defaults
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const referralRate = totalClients > 0 ? referralSubmissions / totalClients : 0
  const referralRatePct = Math.round(referralRate * 100)
  const totalReferralCost = referralSubmissions * referralBonusPerClient
  const cac = referralBonusPerClient // cost per referred lead = the bonus itself

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fmtUsd = (n: number) =>
    n === 0 ? "$0" : `$${Math.round(n).toLocaleString()}`

  // Progress arc (SVG) — simple stroke-dashoffset trick, 0–100%
  const RADIUS = 28
  const CIRC = 2 * Math.PI * RADIUS
  const filled = CIRC * (1 - referralRate)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Referral Performance
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex items-stretch gap-6">

            {/* ── LEFT: Referral Rate ─────────────────────────────────────── */}
            <div className="flex flex-1 flex-col items-center gap-3">
              {/* SVG progress ring */}
              <div className="relative flex items-center justify-center">
                <svg width={72} height={72} viewBox="0 0 72 72" className="-rotate-90">
                  {/* track */}
                  <circle
                    cx={36}
                    cy={36}
                    r={RADIUS}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={6}
                  />
                  {/* fill */}
                  <circle
                    cx={36}
                    cy={36}
                    r={RADIUS}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={filled}
                    style={{ transition: "stroke-dashoffset 0.6s ease" }}
                  />
                </svg>
                <span className="absolute text-lg font-bold tabular-nums text-foreground">
                  {referralRatePct}%
                </span>
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-foreground leading-tight">Referral Rate</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {referralSubmissions} / {totalClients} clients
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-border self-stretch" />

            {/* ── RIGHT: CAC ─────────────────────────────────────────────── */}
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums text-foreground leading-tight">
                  {fmtUsd(cac)}
                </p>
                <p className="text-sm font-medium text-foreground leading-tight">CAC (Referral)</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Total bonus: {fmtUsd(totalReferralCost)}
                </p>
              </div>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  )
}
