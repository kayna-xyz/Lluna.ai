"use client"

import { useEffect, useState } from "react"
import { Phone } from "lucide-react"
import { clinicFetch } from "@/app/clinicside/lib/clinic-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ReferralRow = {
  id: string
  referredPhone: string
  dateISO: string
  referrerName: string
  source: string
}

export function ReferralMemo() {
  const [rows, setRows] = useState<ReferralRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await clinicFetch("/api/referrals-from-reports")
        const data = await res.json()
        if (!cancelled && data.referrals) setRows(data.referrals)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          Referral Memo
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Friend phone (survey referral field) · date · referrer name — from client reports.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No referral entries yet.</p>
        )}
        {rows.map((memo) => (
          <div
            key={memo.id}
            className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="font-mono text-sm font-medium">{memo.referredPhone}</div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{new Date(memo.dateISO).toLocaleDateString()}</span>
              <span className="text-foreground font-medium">{memo.referrerName}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
