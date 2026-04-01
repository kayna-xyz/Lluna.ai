"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdvisorClinicSlug } from "@/app/clinicside/lib/clinic-api"
import { getConsumerLandingUrl } from "@/lib/consumer-landing-url"

export function ClinicQrCard() {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const regenerate = useCallback(async () => {
    setLoading(true)
    try {
      const s = getAdvisorClinicSlug()
      const url = getConsumerLandingUrl(s)
      const QR = (await import("qrcode")).default
      const png = await QR.toDataURL(url, {
        width: 220,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#171717", light: "#ffffff" },
      })
      setDataUrl(png)
    } catch (e) {
      console.error(e)
      setDataUrl(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void regenerate()
  }, [regenerate])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">In-store QR</CardTitle>
        <CardDescription>
          Clients scan this code to sign in and access this clinic's personalized experience.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="inline-block rounded-lg border bg-white p-2">
          {loading ? (
            <div className="h-[220px] w-[220px] animate-pulse rounded bg-muted" />
          ) : dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL from qrcode
            <img src={dataUrl} alt="QR code for clinic landing URL" width={220} height={220} className="block" />
          ) : (
            <div className="flex h-[220px] w-[220px] items-center justify-center p-2 text-center text-xs text-muted-foreground">
              Unable to generate QR
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
