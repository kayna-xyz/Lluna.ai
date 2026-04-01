"use client"

export const dynamic = 'force-dynamic'

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import { LLUNA_CLINIC_SLUG_KEY } from "@/lib/consumer-clinic"

function JoinInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const clinic = (searchParams.get("clinic") || "default").trim()

    try { localStorage.setItem(LLUNA_CLINIC_SLUG_KEY, clinic) } catch { /* ignore */ }

    const supabase = getBrowserSupabase()
    if (!supabase) { router.replace("/"); return }

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace(`/app?clinic=${encodeURIComponent(clinic)}`)
        return
      }

      const callbackUrl = new URL(`${window.location.origin}/auth/callback`)
      callbackUrl.searchParams.set("clinic", clinic)
      callbackUrl.searchParams.set("role", "consumer")

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl.toString() },
      })
    })()
  }, [searchParams, router])

  return null
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinInner />
    </Suspense>
  )
}
