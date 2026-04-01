"use client"

export const dynamic = 'force-dynamic'

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import { LLUNA_CLINIC_SLUG_KEY } from "@/lib/consumer-clinic"

/**
 * /join?clinic=<slug>
 *
 * Clinic QR code entry point. Renders nothing visible — on mount it immediately
 * fires Google OAuth using the same browser-side flow as the login button.
 * No intermediate page, no button to click.
 *
 * Already-authenticated users are sent straight to /app?clinic=<slug>.
 */
export default function JoinPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const clinic = (searchParams.get("clinic") || "default").trim()

    // Persist clinic context so it survives the OAuth round-trip.
    try { localStorage.setItem(LLUNA_CLINIC_SLUG_KEY, clinic) } catch { /* ignore */ }

    const supabase = getBrowserSupabase()
    if (!supabase) { router.replace("/"); return }

    void (async () => {
      // Already signed in — go straight to the app.
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace(`/app?clinic=${encodeURIComponent(clinic)}`)
        return
      }

      // Fire Google OAuth immediately — browser handles the redirect.
      const callbackUrl = new URL(`${window.location.origin}/auth/callback`)
      callbackUrl.searchParams.set("clinic", clinic)
      callbackUrl.searchParams.set("role", "consumer")

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl.toString() },
      })
    })()
  }, [searchParams, router])

  // Blank page — user is redirected before they see anything.
  return null
}
