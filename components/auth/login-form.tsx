"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import { LUME_CLINIC_SLUG_KEY } from "@/lib/consumer-clinic"
import { LoginOauthRecovery } from "@/components/auth/login-oauth-recovery"

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [clinicSlug, setClinicSlug] = useState<string | null>(null)
  const [role, setRole] = useState<string>("advisor")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const slug = params.get("clinic")?.trim() || params.get("clinicSlug")?.trim() || null
    const r = params.get("role")?.trim() || "consumer"
    setClinicSlug(slug)
    setRole(r)
    if (slug) {
      localStorage.setItem(LUME_CLINIC_SLUG_KEY, slug)
    }
  }, [])

  const handleGoogleLogin = async () => {
    const supabase = getBrowserSupabase()
    if (!supabase) return
    setLoading(true)

    const callbackUrl = new URL(`${window.location.origin}/auth/callback`)
    if (clinicSlug) callbackUrl.searchParams.set("clinic", clinicSlug)
    callbackUrl.searchParams.set("role", role)

    const params = new URLSearchParams(window.location.search)
    const next = params.get("next")
    if (next) callbackUrl.searchParams.set("next", next)

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    })
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-background">
      <LoginOauthRecovery />
      <div className="absolute top-6 left-6 md:top-8 md:left-8">
        <svg viewBox="0 0 120 32" className="h-5 w-auto md:h-6" aria-label="Lume logo">
          <text x="0" y="26" fontFamily="serif" fontSize="28" fontWeight="600" fill="currentColor">
            Lume
          </text>
        </svg>
      </div>

      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-left space-y-3">
          <h1 className="text-[40px] md:text-[72px] leading-[1.1] font-normal tracking-tight font-serif text-foreground text-balance">
            Aesthetics, meet intelligence.
          </h1>
          <p className="text-sm text-muted-foreground">
            {"Don't have an account? "}
            <button className="hover:text-foreground transition-colors duration-200 ease">
              Just continue.
            </button>
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="h-11 w-full rounded-none shadow-none bg-neutral-900 text-neutral-50 border-0 hover:bg-neutral-800 transition-colors duration-200 ease flex items-center justify-center gap-2"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {loading ? "Redirecting…" : "Continue with Google"}
          </Button>

          <div className="relative flex items-center justify-center">
            <span className="text-xs text-muted-foreground">or</span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-none shadow-none border border-neutral-300 bg-background text-foreground hover:bg-muted transition-colors duration-200 ease flex items-center justify-center"
            onClick={() => router.push("/clinicside/auth")}
          >
            Enterprise log in
          </Button>
        </div>
      </div>

      <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8">
        <p className="text-xs text-muted-foreground">© 2026 Lume AI. All Rights Reserved.</p>
      </div>
    </div>
  )
}
