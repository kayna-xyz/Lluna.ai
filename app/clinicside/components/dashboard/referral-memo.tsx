"use client"

import { useEffect, useState } from "react"
import { Phone, Download } from "lucide-react"
import { clinicFetch } from "@/app/clinicside/lib/clinic-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type ReferralRow = {
  id: string
  referredPhone: string
  dateISO: string
  referrerName: string
  source: string
}

function exportCSV(rows: ReferralRow[]) {
  const header = "Phone,Date,Referrer,Source"
  const body = rows.map((r) =>
    [r.referredPhone, new Date(r.dateISO).toLocaleDateString(), r.referrerName, r.source || ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  )
  const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "referral-memo.csv"
  a.click()
  URL.revokeObjectURL(url)
}

function exportTXT(rows: ReferralRow[]) {
  const lines = rows.map(
    (r) => `${r.referredPhone}\t${new Date(r.dateISO).toLocaleDateString()}\t${r.referrerName}`,
  )
  const blob = new Blob([lines.join("\n")], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "referral-memo.txt"
  a.click()
  URL.revokeObjectURL(url)
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
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Referral Memo
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Friend phone (survey referral field) · date · referrer name — from client reports.
            </p>
          </div>
          {rows.length > 0 && (
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => exportCSV(rows)}>
                <Download className="h-3 w-3" />
                CSV
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => exportTXT(rows)}>
                <Download className="h-3 w-3" />
                TXT
              </Button>
            </div>
          )}
        </div>
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
